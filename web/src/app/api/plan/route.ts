// POST /api/plan  PlanRequest  →  DayPlan
// Code does the math (free gaps, study blocks, leave times, heat); Gemini only ranks events,
// estimates homework time and writes the spoken briefing. Each Gemini step has a plain-code fallback.
import { loadBuildings } from "@/lib/buildings";
import { generateJson } from "@/lib/gemini";
import {
  CLASS_TRAVEL_BUFFER_MIN,
  addDays,
  DAY_END,
  DAY_START,
  addLeaveTimes,
  atTime,
  classItems,
  clock,
  defaultStudyMinutes,
  fittingEvents,
  freeGaps,
  mstDate,
  opportunityToItem,
  pickCandidates,
  placeStudyBlocks,
  rankByOverlap,
  reserveTime,
  sortByStart,
  templateBriefing,
  walkMinutes,
  weekdayOf,
} from "@/lib/planner";
import { buildingWord, findPlace, placeLabel, polishLine, spokenAssignment, spokenStop } from "@/lib/places";
import { sanitizePlanRequest } from "@/lib/sanitize";
import { FULL_DAY, isCourse, spokenItem, tidyBriefing } from "@/lib/say";
import { savePlan } from "@/lib/saved-plans";
import type { DayItem, DayPlan, PlanRequest } from "@/lib/types";

const MAX_SUGGESTIONS = 3;
const MAX_PICKS = 6; // Gemini ranks a few extra, because study blocks may take the time of some
const MAX_CANDIDATES = 40; // keeps the Gemini prompt small

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Send JSON matching PlanRequest in web/src/lib/types.ts." }, { status: 400 });
  }
  const parsed = sanitizePlanRequest(raw);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const body = parsed.value;

  const now = body.now ? new Date(body.now) : new Date();
  const date = body.date ?? mstDate(now);
  // A later day (look-ahead) is planned from its start: nothing due before it, the whole day free.
  const ahead = date > mstDate(now) ? dayLabel(date, mstDate(now)) : null;
  const nowMs = ahead ? atTime(date, "00:00").getTime() : now.getTime();
  const buildings = await loadBuildings();
  const interests = body.interests ?? [];

  // 1. Fixed parts of the day: classes, events the student already accepted, deadlines due today.
  const classes = classItems(body.classes, date, buildings);
  const accepted = new Set((body.acceptedEventIds ?? []).map((id) => (id.startsWith("ev-") ? id : `ev-${id}`)));
  const dayEvents = (body.events ?? [])
    .map((o) => opportunityToItem(o, buildings))
    .filter((e): e is DayItem => e !== null && mstDate(new Date(e.start)) === date);
  const acceptedEvents = dayEvents.filter((e) => accepted.has(e.id));
  const deadlines = (body.deadlines ?? []).filter((d) => d.type === "deadline");
  const deadlinesToday = deadlines.filter((d) => mstDate(new Date(d.start)) === date);

  // 2. Leave times for the fixed stops, then the free time left around them and the events that fit into it.
  //    A student who asked for more walking time gets it on every walk, including the one to a suggested event.
  const slower = body.pace === "slower";
  const fixedStops = sortByStart([...classes, ...acceptedEvents]);
  addLeaveTimes(fixedStops, buildings, body.startBuildingId, body.weather, slower);
  const gaps = freeGaps(atTime(date, DAY_START).getTime(), atTime(date, DAY_END).getTime(), fixedStops, CLASS_TRAVEL_BUFFER_MIN);
  const travelMin = walkMinutes(undefined, undefined, body.weather?.isHot ?? false, slower);
  const candidates = pickCandidates(fittingEvents(dayEvents.filter((e) => !accepted.has(e.id)), gaps, nowMs, travelMin), interests, MAX_CANDIDATES);
  const openDeadlines = deadlines.filter((d) => !d.done && Date.parse(d.start) > nowMs);

  // 3. Gemini, two calls in parallel: rank events for this student (best first), and estimate homework time on
  //    its own, so adding an event does not change the estimates and move the morning's study blocks.
  const about = new Map((body.events ?? []).map((o) => [`ev-${o.id}`, o.description ?? ""]));
  const [ranked, estimated] = await Promise.all([rankEvents(candidates, interests, fixedStops, about), estimateMinutes(openDeadlines)]);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const seen = new Set<string>();
  let ordered: DayItem[] = (ranked ?? [])
    .filter((p) => byId.has(p.id) && !seen.has(p.id) && seen.add(p.id))
    .map((p) => ({ ...byId.get(p.id)!, why: polishLine(p.why) }));
  if (!ordered.length) ordered = rankByOverlap(candidates, interests).map(({ item, why }) => ({ ...item, why }));
  const estimates = new Map((estimated ?? []).map((e) => [e.id, Math.min(180, Math.max(15, Math.round(e.minutes)))]));

  // 4. Hold time for Sol's picks first, then place study blocks in what is left. So the timeline never puts a
  //    study block on top of a suggestion, and "add the robotics meeting" finds the event it names.
  const { suggestions, study } = picksThenStudy(ordered, gaps, openDeadlines, nowMs, travelMin, (id) => estimates.get(id) ?? defaultStudyMinutes());
  const items = sortByStart([...fixedStops, ...deadlinesToday, ...study]);

  // 5. Gemini call 3: the spoken briefing.
  const aiBriefing = await writeBriefing(items, suggestions, openDeadlines, body, date, ahead);

  const plan: DayPlan = {
    date,
    items,
    suggestions,
    weather: body.weather,
    briefing: polishLine(
      aiBriefing ?? templateBriefing(items, suggestions, body.weather, ahead ? ahead[0].toUpperCase() + ahead.slice(1) : undefined),
    ),
    aiUsed: ranked !== null || estimated !== null || aiBriefing !== null,
  };
  // MongoDB Atlas (optional): save the day so a calendar app can subscribe to it. Never blocks the plan.
  if (body.calendarId && (await savePlan(body.calendarId, plan))) {
    plan.calendarUrl = `${new URL(request.url).origin}/api/plan/${body.calendarId}/calendar`;
  }
  return Response.json(plan);
}

type Gap = Parameters<typeof reserveTime>[0][number];

/**
 * Sol's picks and the study blocks, picks first. The top pick always keeps its time. Each next pick (best first)
 * keeps its time only when it does not overlap a pick already kept and no assignment gets less study time than
 * with the top pick alone, so homework is never starved for an event. A pick that was not held still shows when
 * it fits around the study blocks. `gaps` is left as it was.
 */
function picksThenStudy(
  ordered: DayItem[],
  gaps: Gap[],
  deadlines: DayItem[],
  nowMs: number,
  travelMin: number,
  minutesFor: (id: string) => number,
): { suggestions: DayItem[]; study: DayItem[] } {
  const hold = (free: Gap[], e: DayItem) => reserveTime(free, Date.parse(e.start) - travelMin * 60_000, Date.parse(e.end ?? e.start));
  // reserveTime and placeStudyBlocks change the gaps (and the gap objects) they get, so each try works on a copy.
  const freeAround = (held: DayItem[]) => {
    const free = gaps.map((g) => ({ ...g }));
    for (const e of held) hold(free, e);
    return free;
  };
  const studyWith = (held: DayItem[]) => {
    const free = freeAround(held);
    return { free, study: placeStudyBlocks(deadlines, free, nowMs, minutesFor) };
  };
  // Study minutes per assignment (blocks are titled "Work on: <assignment>").
  const minutes = (study: DayItem[]) => {
    const total = new Map<string, number>();
    for (const b of study) total.set(b.title, (total.get(b.title) ?? 0) + Date.parse(b.end ?? b.start) - Date.parse(b.start));
    return total;
  };

  const held = ordered.slice(0, 1);
  const floor = minutes(studyWith(held).study);
  for (const e of ordered.slice(1)) {
    if (held.length >= MAX_SUGGESTIONS) break;
    if (!fittingEvents([e], freeAround(held), nowMs, travelMin).length) continue;
    const got = minutes(studyWith([...held, e]).study);
    if ([...floor].every(([title, ms]) => (got.get(title) ?? 0) >= ms)) held.push(e);
  }

  const { free, study } = studyWith(held);
  const shown = new Set(held);
  for (const e of ordered) {
    if (shown.size >= MAX_SUGGESTIONS) break;
    if (shown.has(e) || !fittingEvents([e], free, nowMs, travelMin).length) continue;
    shown.add(e);
    hold(free, e);
  }
  return { suggestions: ordered.filter((e) => shown.has(e)), study };
}

type Pick = { id: string; why: string };
type Estimate = { id: string; minutes: number };

// Words that make Sol sound like a stock assistant or an ad; banned in every prompt.
const BANNED =
  '"Good morning", "Good afternoon", "Good evening", "Be sure to", "Make sure", "Consider", "Don\'t forget", "Remember", "stay hydrated", "intense", "awesome", "amazing", "epic", "crush", "Hey Sun Devil", "You\'ll want to", "Tackle", "catch", "head to", "You can also", "You\'ve got", "right now", exclamation marks or emoji';
// The model still slips one of these in now and then. A briefing with one is not used (the plain-code briefing
// is, and the answer is not cached), because Sol says it out loud.
const STOCK_PHRASES = /\b(good (morning|afternoon|evening)|be sure to|make sure|don'?t forget|remember|stay hydrated|hey sun devil)\b/i;

/** Gemini ranks the events that fit (best first) and writes one fact-based reason per pick. */
async function rankEvents(candidates: DayItem[], interests: string[], stops: DayItem[], about: Map<string, string>): Promise<Pick[] | null> {
  if (!candidates.length) return null;
  const wanted = new Set(interests.map((i) => i.toLowerCase()));
  // The facts a reason may use: what the event offers, which of the student's interests it matches, and where it
  // sits in their day ("after your work shift", "before CSE 240").
  const facts = candidates.map((c) => {
    const start = Date.parse(c.start);
    const end = Date.parse(c.end ?? c.start);
    let before: DayItem | undefined;
    for (const s of stops) if (Date.parse(s.end ?? s.start) <= start) before = s;
    const after = stops.find((s) => Date.parse(s.start) >= end);
    return {
      id: c.id,
      title: c.title,
      time: clock(c.start),
      place: c.location ? placeLabel(c.location) : "",
      about: (about.get(c.id) ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
      matches: (c.tags ?? []).filter((t) => wanted.has(t.toLowerCase())),
      fits: [before ? `after ${spokenItem(before)}` : "", after ? `before ${spokenItem(after)}` : ""].filter(Boolean).join(", ") || "a free part of the day",
    };
  });
  const prompt = [
    "You are Sol, the sun mascot of Sundial, a day planner for Arizona State University students in Tempe.",
    `The student's interests: ${interests.length ? interests.join(", ") : "not given; prefer free, social or career events"}.`,
    `Pick at most ${MAX_PICKS} events from EVENTS that fit them, best first. Use only ids from EVENTS; pick none if nothing fits.`,
    `For each pick write "why": one plain sentence of at most 14 words, from the facts given. Lead with one concrete hook from "about" when it has one (free lunch, pizza, no experience needed, a demo), then say when it fits, like "Free lunch and internship tips, right before your work shift." No two reasons may start with the same three words. Never start with "You like" or "You picked". Use contractions. Don't repeat the event's title, time or place: the student sees them right next to your reason. Never use ${BANNED}.`,
    `EVENTS: ${JSON.stringify(facts)}`,
  ].join("\n");
  const schema = {
    type: "object",
    properties: {
      picks: { type: "array", items: { type: "object", properties: { id: { type: "string" }, why: { type: "string" } }, required: ["id", "why"] } },
    },
    required: ["picks"],
  };
  const result = await generateJson<{ picks: Pick[] }>(prompt, schema, (v) => {
    const r = v as { picks?: Pick[] };
    return Array.isArray(r?.picks) && r.picks.every((p) => typeof p?.id === "string" && typeof p?.why === "string");
  });
  return result?.picks ?? null;
}

/** Gemini estimates homework minutes. A call of its own, so its cached answer only changes with the deadlines. */
async function estimateMinutes(deadlines: DayItem[]): Promise<Estimate[] | null> {
  if (!deadlines.length) return null;
  const prompt = [
    "For each assignment an Arizona State University undergraduate has on Canvas, estimate how many minutes a typical student needs to finish it (15 to 180).",
    `ASSIGNMENTS: ${JSON.stringify(deadlines.map((d) => ({ id: d.id, title: d.title })))}`,
  ].join("\n");
  const schema = {
    type: "object",
    properties: {
      estimates: { type: "array", items: { type: "object", properties: { id: { type: "string" }, minutes: { type: "number" } }, required: ["id", "minutes"] } },
    },
    required: ["estimates"],
  };
  const result = await generateJson<{ estimates: Estimate[] }>(prompt, schema, (v) => {
    const r = v as { estimates?: Estimate[] };
    return Array.isArray(r?.estimates) && r.estimates.every((e) => typeof e?.id === "string" && Number.isFinite(e?.minutes));
  });
  return result?.estimates ?? null;
}

/** "today", "tomorrow (Tue)" or "Thu Nov 19", in Arizona time, relative to the planned date. */
/** "Mon Nov 16" for a YYYY-MM-DD day. */
function shortDay(day: string): string {
  return `${weekdayOf(day)} ${atTime(day, "12:00").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Phoenix" })}`;
}

/** How to name a later day: "tomorrow, Mon Nov 16" or "Wed Nov 18". */
function dayLabel(date: string, today: string): string {
  return date === addDays(today, 1) ? `tomorrow, ${shortDay(date)}` : shortDay(date);
}

/** Due day relative to the planned date: "today" / "tomorrow (Tue)", or for a look-ahead "that day" / "the next day (Tue)". */
function dueDay(iso: string, date: string, ahead: boolean): string {
  const day = mstDate(new Date(iso));
  if (day === date) return ahead ? "that day" : "today";
  if (day === addDays(date, 1)) return `${ahead ? "the next day" : "tomorrow"} (${weekdayOf(day)})`;
  return shortDay(day);
}

async function writeBriefing(items: DayItem[], suggestions: DayItem[], openDeadlines: DayItem[], body: PlanRequest, date: string, ahead: string | null): Promise<string | null> {
  const day = ahead ? "that day" : "today";
  // Each open assignment is one line below, with its due time and its study time together, and nowhere else:
  // two copies of the same fact are what made Sol say "Lab 7" twice in one breath.
  const open = new Set(openDeadlines.map((d) => d.id));
  const lines = items
    .filter((i) => i.type !== "study_block" && !(i.type === "deadline" && open.has(i.id)))
    .map((i) => {
      const leave = i.leaveAt ? ` (leave at ${clock(i.leaveAt)})` : "";
      // The place as students say it ("Brickyard 210", "the MU"), so the briefing reads and sounds local.
      const place = i.location ? ` at ${placeLabel(i.location)}` : "";
      if (i.type === "deadline") return `${clock(i.start)} deadline: ${spokenAssignment(i.title)} ${i.done ? "[submitted]" : "[not submitted, past due]"}`;
      // Only course codes are classes; a shift or a study group is called by its own name.
      const kind = i.type === "class" && !isCourse(i.title) ? "commitment" : i.type;
      return `${clock(i.start)} ${kind}: ${spokenStop(i.title)}${place}${leave}`;
    });
  const studyTimes = (d: DayItem) =>
    items.filter((i) => i.type === "study_block" && i.title === `Work on: ${d.title}`).map((i) => clock(i.start));
  const openLines = openDeadlines.map((d) => {
    const study = studyTimes(d);
    return `- ${spokenAssignment(d.title)}: due ${dueDay(d.start, date, ahead !== null)} at ${clock(d.start)}${study.length ? `; study time at ${study.join(" and ")}` : ""}`;
  });
  const dueToday = items.filter((i) => i.type === "deadline");
  const allTurnedIn = dueToday.length > 0 && dueToday.every((d) => d.done);
  const prompt = [
    "You are Sol, the sun mascot of Sundial, a day planner for Arizona State University students in Tempe. Write what Sol says out loud about the student's day.",
    ahead
      ? `This is a look-ahead at ${ahead}. Do not greet; start with "${ahead.startsWith("tomorrow") ? "Tomorrow" : `On ${FULL_DAY[weekdayOf(date)]}`}" and cover the whole day.`
      : `It is now ${clock(body.now ?? new Date().toISOString())}. Do not greet; talk only about what is still ahead.`,
    "At most 3 short sentences and 50 words in total, plain text, no lists. Start with the next time to leave (name the class or commitment and the place). Then only what matters most, in time order: the assignment due soonest with its study time, and at most one suggested event. Leave everything else out.",
    "Sound like a friendly student, not an assistant: use contractions (you're, it's) and call places exactly as given. A commitment is not a class: call a work shift a shift.",
    `Speak as Sol, in the first person at least once, about something you planned, like "I saved 8 to 10 am for Lab 7." Labs and homework are worked on, not studied for. Never put "now" next to a clock time.`,
    "Say a suggested event's name the way a student says it to a friend: at most 5 words, never a colon, like \"the internship lunch & learn\".",
    `Never use ${BANNED}.`,
    "Name each assignment once, exactly as written below (its short name and its course): its study time and when it's due go in the same sentence. Never repeat a fact, a time or a place.",
    ahead
      ? 'Never say "tonight", "today" or "that day": this is a later day, so just give the due time.'
      : 'Say "tonight" only for an assignment due today; for one due tomorrow say "tomorrow".',
    body.pace === "slower"
      ? "The student asked for more time to walk, and every leave time below already includes it. Never tell them to hurry, rush or walk fast."
      : "",
    allTurnedIn ? `Everything due ${day} is already turned in, so end with "Forks up."` : "",
    "Use only the times, places, temperatures and due dates given below, exactly as written; never guess or change one. Mention things in time order. Write temperatures as digits, like 78°F, and mention the weather only if it is hot, then say to bring water.",
    body.weather && ahead
      ? `Forecast for that day: high ${Math.round(body.weather.highF)}°F. ${body.weather.isHot ? "It will be a hot day." : "It will not be a hot day."}`
      : body.weather
      ? `Current temperature: ${Math.round(body.weather.tempF)}°F. Today's high: ${Math.round(body.weather.highF)}°F. ${body.weather.isHot ? "It is a hot day." : "It is not a hot day."}`
      : "Weather: unknown, do not mention it.",
    `Schedule for ${day}, in order:\n${lines.join("\n") || "nothing scheduled"}`,
    `Open assignments (not submitted yet):\n${openLines.join("\n") || "none"}`,
    // The building without the room ("the MU", not "the MU 202"): a room number is too much to say out loud.
    `Suggested events: ${suggestions.map((s) => `${s.title} at ${clock(s.start)}${s.location ? ` at ${buildingOnly(s.location)}` : ""}`).join("; ") || "none"}`,
  ]
    .filter(Boolean)
    .join("\n");
  const result = await generateJson<{ briefing: string }>(
    prompt,
    { type: "object", properties: { briefing: { type: "string" } }, required: ["briefing"] },
    (v) => {
      const text = (v as { briefing?: unknown })?.briefing;
      return typeof text === "string" && Boolean(text.trim()) && !STOCK_PHRASES.test(text);
    },
  );
  const text = result?.briefing ? tidyBriefing(result.briefing) : "";
  return text ? text : null;
}

/** "the MU" for "Memorial Union 202": the building students name, or the place as given when it is not known. */
function buildingOnly(location: string): string {
  const { building } = findPlace(location);
  return building ? buildingWord(building) : placeLabel(location);
}
