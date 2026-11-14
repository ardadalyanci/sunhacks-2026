// POST /api/plan  PlanRequest  →  DayPlan
// Code does the math (free gaps, study blocks, leave times, heat); Gemini only ranks events,
// estimates homework time and writes the spoken briefing. Each Gemini step has a plain-code fallback.
import { loadBuildings } from "@/lib/buildings";
import { generateJson } from "@/lib/gemini";
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
  sortByStart,
  templateBriefing,
} from "@/lib/planner";
import type { DayItem, DayPlan, PlanRequest } from "@/lib/types";

const MAX_SUGGESTIONS = 3;
const MAX_CANDIDATES = 40; // keeps the Gemini prompt small

export async function POST(request: Request) {
  let body: PlanRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON matching PlanRequest in web/src/lib/types.ts." }, { status: 400 });
  }
  if (!Array.isArray(body.classes)) return Response.json({ error: "`classes` must be an array (it can be empty)." }, { status: 400 });

  const now = body.now && !Number.isNaN(Date.parse(body.now)) ? new Date(body.now) : new Date();
  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : mstDate(now);
  const nowMs = now.getTime();
  const buildings = await loadBuildings();
  const interests = (body.interests ?? []).filter((i) => typeof i === "string" && i.trim()).slice(0, 20);

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
  const candidates = fittingEvents(dayEvents.filter((e) => !accepted.has(e.id)), gaps, nowMs)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, MAX_CANDIDATES);
  const openDeadlines = deadlines.filter((d) => !d.done && Date.parse(d.start) > nowMs);

  // 3. Gemini call 1: pick events for this student and estimate homework time.
  const ranked = await rankAndEstimate(candidates, openDeadlines, interests);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  let suggestions: DayItem[] = (ranked?.picks ?? [])
    .filter((p) => byId.has(p.id))
    .slice(0, MAX_SUGGESTIONS)
    .map((p) => ({ ...byId.get(p.id)!, why: p.why }));
  if (!suggestions.length) {
    suggestions = rankByOverlap(candidates, interests)
      .slice(0, MAX_SUGGESTIONS)
      .map(({ item, why }) => ({ ...item, why }));
  }
  const estimates = new Map((ranked?.estimates ?? []).map((e) => [e.id, Math.min(180, Math.max(15, Math.round(e.minutes)))]));

  // 4. Study blocks in the remaining free time (they have no building, so the leave times above stay valid).
  const study = placeStudyBlocks(openDeadlines, gaps, nowMs, (id) => estimates.get(id) ?? defaultStudyMinutes());
  const items = sortByStart([...fixedStops, ...deadlinesToday, ...study]);

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
    `Pick at most ${MAX_SUGGESTIONS} events from EVENTS that best fit them. For each, write "why": one friendly sentence (max 18 words) addressed to the student. Use only ids from EVENTS; pick none if nothing fits.`,
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
  const result = await generateJson<RankResult>(prompt, schema);
  if (!result || !Array.isArray(result.picks) || !Array.isArray(result.estimates)) return null;
  return result;
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
  const result = await generateJson<{ briefing: string }>(prompt, {
    type: "object",
    properties: { briefing: { type: "string" } },
    required: ["briefing"],
  });
  const text = result?.briefing?.trim();
  return text ? text : null;
}
