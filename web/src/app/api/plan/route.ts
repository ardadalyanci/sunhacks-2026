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
import { placeLabel, polishLine, spokenAssignment, spokenStop } from "@/lib/places";
import { sanitizePlanRequest } from "@/lib/sanitize";
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
  const [ranked, estimated] = await Promise.all([rankEvents(candidates, interests, fixedStops), estimateMinutes(openDeadlines)]);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const seen = new Set<string>();
  let ordered: DayItem[] = (ranked ?? [])
    .filter((p) => byId.has(p.id) && !seen.has(p.id) && seen.add(p.id))
    .map((p) => ({ ...byId.get(p.id)!, why: polishLine(p.why) }));
  if (!ordered.length) ordered = rankByOverlap(candidates, interests).map(({ item, why }) => ({ ...item, why }));
  const estimates = new Map((estimated ?? []).map((e) => [e.id, Math.min(180, Math.max(15, Math.round(e.minutes)))]));

  // 4. Keep the best event's time free, place study blocks in what is left, then keep only the other
  //    suggestions that still fit. So the timeline never puts a study block on top of a suggestion.
  if (ordered[0]) reserveTime(gaps, Date.parse(ordered[0].start) - travelMin * 60_000, Date.parse(ordered[0].end ?? ordered[0].start));
  const study = placeStudyBlocks(openDeadlines, gaps, nowMs, (id) => estimates.get(id) ?? defaultStudyMinutes());
  const suggestions = [...ordered.slice(0, 1), ...fittingEvents(ordered.slice(1), gaps, nowMs, travelMin)].slice(0, MAX_SUGGESTIONS);
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

const FULL_DAY: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

type Pick = { id: string; why: string };
type Estimate = { id: string; minutes: number };

// Words that make Sol sound like a stock assistant or an ad; banned in every prompt.
const BANNED =
  '"Good morning", "Good afternoon", "Good evening", "Be sure to", "Make sure", "Consider", "Don\'t forget", "Remember", "stay hydrated", "intense", "awesome", "amazing", "epic", "crush", "Hey Sun Devil", exclamation marks or emoji';
// The model still slips one of these in now and then. A briefing with one is not used (the plain-code briefing
// is, and the answer is not cached), because Sol says it out loud.
const STOCK_PHRASES = /\b(good (morning|afternoon|evening)|be sure to|make sure|don'?t forget|remember|stay hydrated|hey sun devil)\b/i;

/** Gemini ranks the events that fit (best first) and writes one fact-based reason per pick. */
async function rankEvents(candidates: DayItem[], interests: string[], stops: DayItem[]): Promise<Pick[] | null> {
  if (!candidates.length) return null;
  const wanted = new Set(interests.map((i) => i.toLowerCase()));
  // The facts a reason may use: which of the student's interests it matches, and where it sits in their day.
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
      matches: (c.tags ?? []).filter((t) => wanted.has(t.toLowerCase())),
      fits: [before ? `after ${spokenStop(before.title)}` : "", after ? `before ${spokenStop(after.title)}` : ""].filter(Boolean).join(", ") || "a free part of the day",
    };
  });
  const prompt = [
    "You are Sol, the sun mascot of Sundial, a day planner for Arizona State University students in Tempe.",
    `The student's interests: ${interests.length ? interests.join(", ") : "not given; prefer free, social or career events"}.`,
    `Pick at most ${MAX_PICKS} events from EVENTS that fit them, best first. Use only ids from EVENTS; pick none if nothing fits.`,
    `For each pick write "why": one plain sentence of at most 14 words that names the interest it matches and when it fits, from the facts given, like "You picked robotics, and you're free after CSE 240." Use contractions. Don't repeat the event's title, time or place: the student sees them right next to your reason. Never use ${BANNED}.`,
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
      const leave = i.leaveAt ? ` (leave by ${clock(i.leaveAt)})` : "";
      // The place as students say it ("Brickyard 210", "the MU"), so the briefing reads and sounds local.
      const place = i.location ? ` at ${placeLabel(i.location)}` : "";
      if (i.type === "deadline") return `${clock(i.start)} deadline: ${spokenAssignment(i.title)} ${i.done ? "[submitted]" : "[not submitted, past due]"}`;
      // Only course codes are classes; a shift or a study group is called by its own name.
      const kind = i.type === "class" && !/^[A-Z]{2,4} \d{3}/.test(i.title) ? "commitment" : i.type;
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
    `Suggested events: ${suggestions.map((s) => `${s.title} at ${clock(s.start)}${s.location ? ` at ${placeLabel(s.location)}` : ""}`).join("; ") || "none"}`,
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
  const text = result?.briefing?.trim();
  return text ? text : null;
}
