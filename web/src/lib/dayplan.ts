// The planning pipeline shared by POST /api/plan (engine types) and POST /api/day (UI types).
// Code does the math (free gaps, study blocks, leave times, heat); Gemini only ranks events,
// estimates homework time and writes the spoken briefing. Each Gemini step has a plain-code fallback.
import { loadBuildings } from "./buildings";
import { generateJson } from "./gemini";
import {
  CLASS_TRAVEL_BUFFER_MIN,
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
  placeStudyBlocks,
  rankByOverlap,
  reserveTime,
  sortByStart,
  templateBriefing,
  walkMinutes,
} from "./planner";
import type { DayItem, DayPlan, PlanRequest } from "./engine-types";

const MAX_SUGGESTIONS = 3;
const MAX_PICKS = 6; // Gemini ranks a few extra, because study blocks may take the time of some
const MAX_CANDIDATES = 40; // keeps the Gemini prompt small

export interface PlanResult {
  plan: DayPlan;
  /** Every deadline in the request, with `estimatedMinutes` filled in for unsubmitted ones. */
  deadlines: DayItem[];
}

/** The whole planning pipeline. Input must already be cleaned by sanitizePlanRequest. */
export async function planDay(body: PlanRequest): Promise<PlanResult> {
  const now = body.now ? new Date(body.now) : new Date();
  const date = body.date ?? mstDate(now);
  const nowMs = now.getTime();
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
  const candidates = fittingEvents(dayEvents.filter((e) => !accepted.has(e.id)), gaps, nowMs, travelMin)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, MAX_CANDIDATES);
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
  const items = sortByStart([...fixedStops, ...withEstimates(deadlinesToday), ...study]);

  // 5. Gemini call 2: the spoken briefing.
  const aiBriefing = await writeBriefing(items, suggestions, body);

  const plan: DayPlan = {
    date,
    items,
    suggestions,
    weather: body.weather,
    briefing: aiBriefing ?? templateBriefing(items, suggestions, body.weather),
    aiUsed: ranked !== null || aiBriefing !== null,
  };
  return { plan, deadlines: withEstimates(deadlines) };

  function withEstimates(list: DayItem[]): DayItem[] {
    return list.map((d) => (d.done ? d : { ...d, estimatedMinutes: estimates.get(d.id) ?? defaultStudyMinutes() }));
  }
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

async function writeBriefing(items: DayItem[], suggestions: DayItem[], body: PlanRequest): Promise<string | null> {
  const lines = items.map((i) => {
    const leave = i.leaveAt ? ` (leave by ${clock(i.leaveAt)})` : "";
    const place = i.location ? ` at ${i.location}` : "";
    const status = i.type === "deadline" ? (i.done ? " [submitted]" : " [not submitted]") : "";
    return `${clock(i.start)} ${i.type}: ${i.title}${place}${leave}${status}`;
  });
  const prompt = [
    "Write the morning briefing a friendly assistant would say out loud to an ASU student in Tempe.",
    "3 to 5 short sentences, at most 90 words, plain text, no lists, no emoji. Use times like 1:12 PM.",
    "Mention the heat if it is hot, when to leave for the first class, unsubmitted deadlines and the planned study time, and at most one suggested event.",
    body.weather ? `Weather: now ${Math.round(body.weather.tempF)}°F, high ${Math.round(body.weather.highF)}°F, hot: ${body.weather.isHot}.` : "Weather: unknown.",
    `Schedule:\n${lines.join("\n") || "nothing scheduled"}`,
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
