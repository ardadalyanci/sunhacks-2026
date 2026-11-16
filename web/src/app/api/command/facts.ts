// The day as plain facts for Sol's answers: everything Gemini may say comes from here, worked out by code (times,
// leave times, how each trip is made, free time, what is due and whether it is turned in, the weather). Gemini
// only phrases them. Also the code answers for the chips under the chat, so those work without Gemini.
import { placeLabel, polishLine, spokenAssignment } from "@/lib/places";
import { DAY_END, DAY_START, atTime, clock, freeGaps, mstDate } from "@/lib/planner";
import type { DayItem, Weather } from "@/lib/types";

export type CommandDay = {
  date: string; // the plan's day, "2026-11-16"
  items: DayItem[];
  suggestions: DayItem[];
  deadlines: DayItem[]; // every deadline the Due soon card shows, with `done`
  weather?: Weather;
};

const MIN = 60_000;
const MIN_FREE_MIN = 20; // shorter gaps are not free time worth naming

const t = (iso: string) => polishLine(clock(iso)); // "10:30 am", "noon"
const span = (i: DayItem) => (i.end ? `${t(i.start)} to ${t(i.end)}` : t(i.start));
const minutesBetween = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / MIN));
const hours = (min: number) => (min < 60 ? `${min} minutes` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`);

function dayWord(iso: string, today: string): string {
  const date = mstDate(new Date(iso));
  if (date === today) return "today";
  const d = new Date(`${date}T12:00:00-07:00`);
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Phoenix" });
}

/** "Leave 10:13 am, a 17-minute walk." / "Leave 1:35 pm. From home by car: …" */
function tripFact(i: DayItem): string {
  if (!i.leaveAt) return i.via ? ` ${i.via}` : "";
  return i.via ? ` Leave ${t(i.leaveAt)}. ${i.via}` : ` Leave ${t(i.leaveAt)}, a ${minutesBetween(i.leaveAt, i.start)}-minute walk.`;
}

function itemFact(i: DayItem, nowMs: number): string {
  const over = Date.parse(i.end ?? i.start) < nowMs ? " (already over)" : "";
  const where = i.location ? ` at ${placeLabel(i.location)}` : "";
  if (i.type === "study_block") return `- ${span(i)}: study time, ${i.title.replace(/^Work on:\s*/, "work on ")}${where}${over}.`;
  const kind = i.type === "event" ? "event" : "class or commitment";
  return `- ${span(i)}: ${i.title} (${kind})${where}${over}.${over ? "" : tripFact(i)}`;
}

/** Free stretches of at least 20 minutes between now and 10 pm, around classes, events and study time. */
export function freeTime(day: CommandDay, nowMs: number): { start: string; end: string; minutes: number }[] {
  const busy = day.items.filter((i) => i.type !== "deadline");
  const from = Math.max(atTime(day.date, DAY_START).getTime(), nowMs);
  const gaps = freeGaps(from, atTime(day.date, DAY_END).getTime(), busy, 0);
  return gaps
    .map((g) => ({ start: new Date(g.start).toISOString(), end: new Date(g.end).toISOString(), minutes: Math.round((g.end - g.start) / MIN) }))
    .filter((g) => g.minutes >= MIN_FREE_MIN);
}

function deadlineFact(d: DayItem, today: string): string {
  return `${spokenAssignment(d.title)}: due ${dayWord(d.start, today)} at ${t(d.start)}, ${d.done ? "turned in" : "not turned in yet"}.`;
}

/** The facts block for Gemini. */
export function dayFacts(day: CommandDay, nowMs: number): string {
  const lines = [`DAY: ${new Date(`${day.date}T12:00:00-07:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Phoenix" })}. NOW: ${t(new Date(nowMs).toISOString())}.`];
  if (day.weather) lines.push(`WEATHER: ${day.weather.tempF}°F now, high ${day.weather.highF}°F${day.weather.isHot ? ", a hot day" : ""}.`);
  const plan = day.items.filter((i) => i.type !== "deadline").sort((a, b) => a.start.localeCompare(b.start));
  lines.push("SCHEDULE:", ...(plan.length ? plan.map((i) => itemFact(i, nowMs)) : ["- nothing planned"]));
  const free = freeTime(day, nowMs);
  lines.push(`FREE TIME FROM NOW: ${free.length ? free.map((g) => `${t(g.start)} to ${t(g.end)} (${hours(g.minutes)})`).join("; ") : "none"}.`);
  const due = [...day.deadlines].sort((a, b) => a.start.localeCompare(b.start));
  lines.push("DEADLINES:", ...(due.length ? due.map((d) => `- ${deadlineFact(d, day.date)}`) : ["- none from Canvas"]));
  if (day.suggestions.length) {
    lines.push(
      "SOL'S PICKS (not on the day unless added):",
      ...day.suggestions.map((s) => `- ${span(s)}: ${s.title}${s.location ? ` at ${placeLabel(s.location)}` : ""}.${s.why ? ` Why: ${s.why}` : ""}`),
    );
  }
  return lines.join("\n");
}

/** "Lab 7 for CSE 230 is due today at 11:59 pm. HW 9 for MAT 343 is turned in." */
export function dueReply(day: CommandDay, nowMs: number): string {
  const open = day.deadlines.filter((d) => !d.done && Date.parse(d.start) > nowMs).sort((a, b) => a.start.localeCompare(b.start));
  const done = day.deadlines.filter((d) => d.done);
  if (!day.deadlines.length) return "I don't see any deadlines. Add your Canvas token in Setup and I'll keep track of them.";
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1); // "the Essay for ENG 102" starts a sentence
  const parts = open.slice(0, 3).map((d) => cap(`${spokenAssignment(d.title)} is due ${dayWord(d.start, day.date)} at ${t(d.start)}`));
  if (open.length > 3) parts.push(`${open.length - 3} more after that`);
  const head = parts.length ? `${parts.join(". ")}.` : "Nothing is left to turn in.";
  return done.length ? `${head} ${cap(done.length === 1 ? `${spokenAssignment(done[0].title)} is` : `${done.length} assignments are`)} already turned in.` : head;
}

/** "You're free 11:20 am to 1:20 pm (2 h) and 2:50 pm to 6 pm (3 h 10 min)." */
export function freeReply(day: CommandDay, nowMs: number): string {
  const free = freeTime(day, nowMs);
  if (!free.length) return "You don't have a free stretch of 20 minutes or more left today.";
  const list = free.slice(0, 3).map((g) => `${t(g.start)} to ${t(g.end)} (${hours(g.minutes)})`);
  return `You're free ${list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0]}.`;
}

/** "It's 97°F now with a high of 101°F. It's a hot day: take water, and I've added time to your walks." */
export function weatherReply(day: CommandDay): string {
  const w = day.weather;
  if (!w) return "I don't have the weather right now.";
  const base = `It's ${w.tempF}°F now with a high of ${w.highF}°F.`;
  return w.isHot ? `${base} It's a hot day: take water, and I've added time to your walks.` : base;
}

/** Every clock time in a line ("10:13 am", "noon"), the way polishLine writes them. */
export function timesIn(text: string): string[] {
  return polishLine(text).match(/\b(\d{1,2}(:\d{2})? [ap]m|noon)\b/gi)?.map((x) => x.toLowerCase()) ?? [];
}

/** "and after that?", "what's before it": a question about what comes after or before something said earlier. */
const RELATIVE = /\b(after|before)\s+(that|it|this|then|those)\b/i;

/**
 * Answers "and after that?" in code: the class or event named last in the chat (newest turn first), then what
 * comes after or before it on the day. Undefined when the question is not like that or nothing named is found.
 */
export function relativeReply(text: string, history: { text: string }[], day: CommandDay): string | undefined {
  const m = RELATIVE.exec(text);
  if (!m) return undefined;
  const stops = day.items.filter((i) => i.type !== "deadline").sort((a, b) => a.start.localeCompare(b.start));
  let named: DayItem | undefined;
  for (const turn of [...history].reverse()) {
    const said = turn.text.toLowerCase();
    // The stop named latest in that turn: "lunch before CSE 240" names CSE 240.
    const hits = stops.map((s) => ({ s, at: said.lastIndexOf(s.title.toLowerCase()) })).filter((h) => h.at >= 0);
    if (hits.length) {
      named = hits.sort((a, b) => b.at - a.at)[0].s;
      break;
    }
  }
  if (!named) return undefined;
  const after = m[1].toLowerCase() === "after";
  const ref = named;
  const list = after
    ? stops.filter((s) => s.start >= (ref.end ?? ref.start) && s !== ref)
    : stops.filter((s) => (s.end ?? s.start) <= ref.start && s !== ref).reverse();
  const name = (s: DayItem) => (s.type === "study_block" ? `study time for ${s.title.replace(/^Work on:\s*/, "")}` : s.title);
  if (!list.length) return after ? `Nothing else is planned after ${ref.title}.` : `Nothing is planned before ${ref.title}.`;
  const parts = list.slice(0, 3).map((s) => `${name(s)} at ${t(s.start)}`);
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  return after ? `After ${ref.title}, you have ${joined}.` : `Before ${ref.title}, you have ${joined}.`;
}

/** Drops sentences about water or heat on a day that is not hot (Gemini likes to add them anyway). */
export function withoutHeatTips(reply: string, weather?: { isHot: boolean }): string {
  if (weather?.isHot) return reply;
  const kept = reply.split(/(?<=[.!])\s+/).filter((s) => !/\b(hydrat\w*|water|heat|sunscreen|degrees)\b/i.test(s));
  return kept.length ? kept.join(" ") : reply;
}
