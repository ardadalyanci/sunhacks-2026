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
  const fixedStops = sortByStart([...classes, ...acceptedEvents]);
  addLeaveTimes(fixedStops, buildings, body.startBuildingId, body.weather);
  const gaps = freeGaps(atTime(date, DAY_START).getTime(), atTime(date, DAY_END).getTime(), fixedStops, CLASS_TRAVEL_BUFFER_MIN);
  const travelMin = walkMinutes(undefined, undefined, body.weather?.isHot ?? false);
  const candidates = pickCandidates(fittingEvents(dayEvents.filter((e) => !accepted.has(e.id)), gaps, nowMs, travelMin), interests, MAX_CANDIDATES);
  const openDeadlines = deadlines.filter((d) => !d.done && Date.parse(d.start) > nowMs);

  // 3. Gemini call 1: rank events for this student (best first) and estimate homework time.
  const ranked = await rankAndEstimate(candidates, openDeadlines, interests);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const seen = new Set<string>();
  let ordered: DayItem[] = (ranked?.picks ?? [])
    .filter((p) => byId.has(p.id) && !seen.has(p.id) && seen.add(p.id))
    .map((p) => ({ ...byId.get(p.id)!, why: p.why }));
  if (!ordered.length) ordered = rankByOverlap(candidates, interests).map(({ item, why }) => ({ ...item, why }));
  const estimates = new Map((ranked?.estimates ?? []).map((e) => [e.id, Math.min(180, Math.max(15, Math.round(e.minutes)))]));

  // 4. Keep the best event's time free, place study blocks in what is left, then keep only the other
  //    suggestions that still fit. So the timeline never puts a study block on top of a suggestion.
  if (ordered[0]) reserveTime(gaps, Date.parse(ordered[0].start) - travelMin * 60_000, Date.parse(ordered[0].end ?? ordered[0].start));
  const study = placeStudyBlocks(openDeadlines, gaps, nowMs, (id) => estimates.get(id) ?? defaultStudyMinutes());
  const suggestions = [...ordered.slice(0, 1), ...fittingEvents(ordered.slice(1), gaps, nowMs, travelMin)].slice(0, MAX_SUGGESTIONS);
  const items = sortByStart([...fixedStops, ...deadlinesToday, ...study]);

  // 5. Gemini call 2: the spoken briefing.
  const aiBriefing = await writeBriefing(items, suggestions, openDeadlines, body, date, ahead);

  const plan: DayPlan = {
    date,
    items,
    suggestions,
    weather: body.weather,
    briefing: aiBriefing ?? templateBriefing(items, suggestions, body.weather, ahead ? ahead[0].toUpperCase() + ahead.slice(1) : undefined),
    aiUsed: ranked !== null || aiBriefing !== null,
  };
  // MongoDB Atlas (optional): save the day so a calendar app can subscribe to it. Never blocks the plan.
  if (body.calendarId && (await savePlan(body.calendarId, plan))) {
    plan.calendarUrl = `${new URL(request.url).origin}/api/plan/${body.calendarId}/calendar`;
  }
  return Response.json(plan);
}

interface RankResult {
  picks: { id: string; why: string }[];
  estimates: { id: string; minutes: number }[];
}

async function rankAndEstimate(candidates: DayItem[], deadlines: DayItem[], interests: string[]): Promise<RankResult | null> {
  if (!candidates.length && !deadlines.length) return null;
  const prompt = [
    "You help an Arizona State University student plan their day.",
    `Their interests: ${interests.length ? interests.join(", ") : "not given; prefer free, social or career events"}.`,
    `Pick at most ${MAX_PICKS} events from EVENTS that fit them, best first. For each, write "why": one friendly sentence (max 18 words) addressed to the student. Use only ids from EVENTS; pick none if nothing fits.`,
    "For each item in DEADLINES, estimate how many minutes a typical undergraduate needs to finish it (15 to 180).",
    `EVENTS: ${JSON.stringify(candidates.map((c) => ({ id: c.id, title: c.title, tags: c.tags ?? [], time: clock(c.start), place: c.location ?? "" })))}`,
    `DEADLINES: ${JSON.stringify(deadlines.map((d) => ({ id: d.id, title: d.title })))}`,
  ].join("\n");
  const schema = {
    type: "object",
    properties: {
      picks: { type: "array", items: { type: "object", properties: { id: { type: "string" }, why: { type: "string" } }, required: ["id", "why"] } },
      estimates: { type: "array", items: { type: "object", properties: { id: { type: "string" }, minutes: { type: "number" } }, required: ["id", "minutes"] } },
    },
    required: ["picks", "estimates"],
  };
  return generateJson<RankResult>(prompt, schema, isRankResult);
}

function isRankResult(v: unknown): v is RankResult {
  const r = v as RankResult;
  return (
    Array.isArray(r?.picks) &&
    Array.isArray(r?.estimates) &&
    r.picks.every((p) => typeof p?.id === "string" && typeof p?.why === "string") &&
    r.estimates.every((e) => typeof e?.id === "string" && Number.isFinite(e?.minutes))
  );
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
  const lines = items.map((i) => {
    const leave = i.leaveAt ? ` (leave by ${clock(i.leaveAt)})` : "";
    const place = i.location ? ` at ${i.location}` : "";
    const status = i.type === "deadline" ? (i.done ? " [submitted]" : " [not submitted]") : "";
    return `${clock(i.start)} ${i.type}: ${i.title}${place}${leave}${status}`;
  });
  const prompt = [
    "Write the day briefing a friendly assistant would say out loud to an ASU student in Tempe.",
    ahead
      ? `This is a look-ahead at ${ahead}. Do not greet for the time of day; start with "${ahead.startsWith("tomorrow") ? "Tomorrow" : `On ${weekdayOf(date)}`}" and cover the whole day.`
      : `It is now ${clock(body.now ?? new Date().toISOString())}; greet for that time of day and talk only about what is still ahead.`,
    "3 to 5 short sentences, at most 90 words, plain text, no lists, no emoji. Use times like 1:12 PM.",
    "Mention the heat if it is hot, when to leave for the next class (name the course), unsubmitted deadlines and the planned study time, and at most one suggested event.",
    `Use only the times, places, temperatures and due dates given below, exactly as written; never guess or change one. Call a deadline "tonight" only if it is due ${day}. Mention things in time order. Write temperatures as digits, like 78°F.`,
    body.weather && ahead
      ? `Forecast for that day: high ${Math.round(body.weather.highF)}°F. ${body.weather.isHot ? "It will be a hot day." : "It will not be a hot day."}`
      : body.weather
      ? `Current temperature: ${Math.round(body.weather.tempF)}°F. Today's high: ${Math.round(body.weather.highF)}°F. ${body.weather.isHot ? "It is a hot day." : "It is not a hot day."}`
      : "Weather: unknown, do not mention it.",
    `Schedule for ${day}, in order:\n${lines.join("\n") || "nothing scheduled"}`,
    `Open deadlines (not submitted yet):\n${openDeadlines.map((d) => `- ${d.title}: due ${dueDay(d.start, date, ahead !== null)} at ${clock(d.start)}`).join("\n") || "none"}`,
    `Suggested events: ${suggestions.map((s) => `${s.title} at ${clock(s.start)}`).join("; ") || "none"}`,
  ].join("\n");
  const result = await generateJson<{ briefing: string }>(
    prompt,
    { type: "object", properties: { briefing: { type: "string" } }, required: ["briefing"] },
    (v) => typeof (v as { briefing?: unknown })?.briefing === "string" && Boolean((v as { briefing: string }).briefing.trim()),
  );
  const text = result?.briefing?.trim();
  return text ? text : null;
}
