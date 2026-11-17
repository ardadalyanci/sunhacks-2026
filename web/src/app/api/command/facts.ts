// The day as plain facts for Sol's answers: everything Gemini may say comes from here, worked out by code (times,
// leave times, how each trip is made, free time, what is due and whether it is turned in, the weather). Gemini
// only phrases them. Also the code answers for the chips under the chat, so those work without Gemini.
import { placeLabel, polishLine, spokenAssignment } from "@/lib/places";
import { DAY_END, DAY_START, addDays, atTime, clock, freeGaps, mstDate } from "@/lib/planner";
import { dayOpener, spokenItem, spokenWhere } from "@/lib/say";
import type { DayItem, TutoringHelp, Weather } from "@/lib/types";

export type CommandDay = {
  date: string; // the plan's day, "2026-11-16"
  today: string; // Arizona's date now; a later `date` is a coming day the student picked (Tomorrow, Wed 18)
  items: DayItem[];
  suggestions: DayItem[];
  deadlines: DayItem[]; // every deadline the Due soon card shows, with `done`
  weather?: Weather;
  help?: TutoringHelp[]; // ASU tutoring for open deadlines (lib/tutoring.ts)
};

const MIN = 60_000;
const MIN_FREE_MIN = 20; // shorter gaps are not free time worth naming

const t = (iso: string) => polishLine(clock(iso)); // "10:30 am", "noon"
const span = (i: DayItem) => (i.end ? `${t(i.start)} to ${t(i.end)}` : t(i.start));
const minutesBetween = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / MIN));
const hours = (min: number) => (min < 60 ? `${min} minutes` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`);

/** "Tomorrow" / "On Wednesday" when the student is looking at a coming day; null for today. */
export function dayAhead(day: CommandDay): string | null {
  return dayOpener(`${day.date}T12:00:00-07:00`, Date.parse(`${day.today}T12:00:00-07:00`));
}

const longDate = (date: string) =>
  new Date(`${date}T12:00:00-07:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Phoenix" });

/** "today", "tomorrow" or the weekday ("Wednesday"), counted from the real today, the way Due soon says it. */
function dayWord(iso: string, today: string): string {
  const date = mstDate(new Date(iso));
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
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
  // A coming day gets no clock time: "now" is another day, and only confuses which day the answer is about.
  const ahead = dayAhead(day);
  const lines = [
    ahead
      ? `DAY: ${longDate(day.date)}, a coming day (today is ${longDate(day.today)}). The student picked this day in the app: every answer is about it.`
      : `DAY: ${longDate(day.date)}. NOW: ${t(new Date(nowMs).toISOString())}.`,
  ];
  if (day.weather) {
    lines.push(
      ahead
        ? `WEATHER: forecast high ${day.weather.highF}°F that day${day.weather.isHot ? ", a hot day" : ""}.`
        : `WEATHER: ${day.weather.tempF}°F now, high ${day.weather.highF}°F${day.weather.isHot ? ", a hot day" : ""}.`,
    );
  }
  const plan = day.items.filter((i) => i.type !== "deadline").sort((a, b) => a.start.localeCompare(b.start));
  lines.push("SCHEDULE:", ...(plan.length ? plan.map((i) => itemFact(i, nowMs)) : ["- nothing planned"]));
  const free = freeTime(day, nowMs);
  lines.push(`${ahead ? "FREE TIME" : "FREE TIME FROM NOW"}: ${free.length ? free.map((g) => `${t(g.start)} to ${t(g.end)} (${hours(g.minutes)})`).join("; ") : "none"}.`);
  const due = [...day.deadlines].sort((a, b) => a.start.localeCompare(b.start));
  lines.push("DEADLINES:", ...(due.length ? due.map((d) => `- ${deadlineFact(d, day.today)}`) : ["- none from Canvas"]));
  if (day.help?.length) lines.push("FREE ASU TUTORING (drop-in):", ...helpLines(day).map((l) => `- ${l}`));
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
  const parts = open.slice(0, 3).map((d) => cap(`${spokenAssignment(d.title)} is due ${dayWord(d.start, day.today)} at ${t(d.start)}`));
  if (open.length > 3) parts.push(`${open.length - 3} more after that`);
  const head = parts.length ? `${parts.join(". ")}.` : "Nothing is left to turn in.";
  return done.length ? `${head} ${cap(done.length === 1 ? `${spokenAssignment(done[0].title)} is` : `${done.length} assignments are`)} already turned in.` : head;
}

/** "You're free 11:20 am to 1:20 pm (2 h) and 2:50 pm to 6 pm (3 h 10 min)." */
export function freeReply(day: CommandDay, nowMs: number): string {
  const free = freeTime(day, nowMs);
  const ahead = dayAhead(day); // "On Wednesday, you're free …"
  if (!free.length) return ahead ? `${ahead}, you don't have a free stretch of 20 minutes or more.` : "You don't have a free stretch of 20 minutes or more left today.";
  const list = free.slice(0, 3).map((g) => `${t(g.start)} to ${t(g.end)} (${hours(g.minutes)})`);
  return `${ahead ? `${ahead}, you're` : "You're"} free ${list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0]}.`;
}

/** "It's 97°F now with a high of 101°F. It's a hot day: take water, and I've added time to your walks." */
export function weatherReply(day: CommandDay): string {
  const w = day.weather;
  if (!w) return "I don't have the weather right now.";
  // A coming day has a forecast high; the temperature "now" belongs to today.
  const ahead = dayAhead(day);
  if (ahead) return `${ahead}, the high is ${w.highF}°F.${w.isHot ? " It'll be a hot day: take water, and I've added time to your walks." : ""}`;
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

/** Each tutoring pointer as words: the assignment, where to go and when. */
function helpParts(day: CommandDay, help = day.help ?? []): { what: string; where: string; when: string }[] {
  return help.flatMap((h) => {
    const d = day.deadlines.find((x) => x.id === h.deadlineId);
    if (!d) return [];
    const where = [h.center, h.place].filter(Boolean).join(", ");
    const when = h.from && h.to ? `usually open while you're free ${t(h.from)} to ${t(h.to)}` : "hours vary by location, the link is on Due soon";
    return [{ what: spokenAssignment(d.title), where, when }];
  });
}

/** "the Reading response for ENG 102: Writing Center, Noble Library 280, usually open while you're free 11:20 am to 1:20 pm." */
function helpLines(day: CommandDay): string[] {
  return helpParts(day).map((p) => `${p.what}: ${p.where}, ${p.when}.`);
}

const COURSE = /\b([A-Z]{2,4}) ?(\d{3}[A-Z]?)\b/i;
const SCHOOLWORK = /\b(homework|hw|assignments?|labs?|essays?|problem sets?|papers?|readings?|projects?|math|physics|chemistry|writing)\b/i;

/**
 * Asking for tutoring: "is there tutoring for MAT 343?", "where can I get help with ENG 102?", "I'm stuck on my
 * lab". Not an edit ("add tutoring at 5", "skip my tutoring shift"), and "help" alone ("I need help planning
 * today") only counts next to a course or schoolwork.
 */
export function isTutoringQuestion(text: string): boolean {
  if (/\b(add|put|schedule|block|join|go to|attend|remove|drop|cancel|skip|delete|move)\b/i.test(text)) return false;
  if (/\b(tutor|tutors|tutoring)\b/i.test(text)) return true;
  return /\b(get help|need help|help with|stuck on)\b/i.test(text) && (COURSE.test(text) || SCHOOLWORK.test(text));
}

/** Sol's answer about tutoring, in code. Only the deadlines of a course the student names, when they name one. */
export function tutoringReply(text: string, day: CommandDay): string {
  const m = COURSE.exec(text);
  const asked = m ? `${m[1]} ${m[2]}`.toUpperCase() : undefined;
  const help = asked
    ? (day.help ?? []).filter((h) => day.deadlines.find((x) => x.id === h.deadlineId)?.title.toUpperCase().startsWith(asked))
    : day.help;
  const parts = helpParts(day, help);
  if (!parts.length) {
    return asked
      ? `I don't see free tutoring that fits before your ${asked} work is due. The hours are on tutoring.asu.edu.`
      : `I don't see free tutoring that fits before your deadlines${dayAhead(day) ? "" : " today"}. Online hours are on tutoring.asu.edu.`;
  }
  return parts
    .slice(0, 2)
    .map((p) => `For ${p.what}, try the ${p.where}, ${p.when}.`)
    .join(" ");
}

const PERIODS = { morning: [0, 12], afternoon: [12, 17], evening: [17, 24], tonight: [17, 24] } as const;
type Period = keyof typeof PERIODS;
const hourOf = (iso: string) => Number(iso.slice(11, 13));
const stopName = (i: DayItem) => (i.type === "study_block" ? `study time for ${spokenItem(i)}` : spokenItem(i));

/**
 * "What do I have this morning?", "what classes do I have?": the classes, events and study time in that part of
 * the day (or all of it), named for the day the student is looking at. Undefined when the question is not like that.
 */
export function scheduleReply(text: string, day: CommandDay): string | undefined {
  const t2 = text.toLowerCase();
  const period = (Object.keys(PERIODS) as Period[]).find((p) => new RegExp(`\\b${p}\\b`).test(t2));
  const classesOnly = /\bclass(es)?\b/.test(t2) && !period;
  if (!period && !classesOnly && !/\b(what do i have|what am i doing|what's on|what is on)\b/.test(t2.replace(/[‘’ʼ]/g, "'"))) return undefined;
  const [from, to] = period ? PERIODS[period] : [0, 24];
  const stops = day.items
    .filter((i) => i.type !== "deadline" && i.type !== "travel" && (!classesOnly || i.type === "class"))
    .filter((i) => hourOf(i.start) >= from && hourOf(i.start) < to)
    .sort((a, b) => a.start.localeCompare(b.start));
  const ahead = dayAhead(day);
  const when = period
    ? ahead
      ? `${ahead} ${period === "tonight" ? "evening" : period}`
      : period === "tonight"
        ? "Tonight"
        : `This ${period}`
    : ahead ?? "Today";
  if (!stops.length) return `${when}, you have ${classesOnly ? "no classes" : "nothing planned"}.`;
  const parts = stops.slice(0, 4).map((i) => `${stopName(i)} at ${t(i.start)}${spokenWhere(i)}`);
  if (stops.length > 4) parts.push(`${stops.length - 4} more after that`);
  return `${when}, you have ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]}.`;
}

/** "Where is CSE 230?": the class or event named, with its time, place and leave time. Undefined otherwise. */
export function whereReply(text: string, day: CommandDay): string | undefined {
  if (!/\bwhere\b/i.test(text)) return undefined;
  const said = text.toLowerCase().replace(/\s+/g, "");
  const stop = day.items.find((i) => (i.type === "class" || i.type === "event") && said.includes(i.title.toLowerCase().replace(/\s+/g, "")));
  if (!stop) return undefined;
  const ahead = dayAhead(day);
  const leave = stop.leaveAt ? ` Leave at ${t(stop.leaveAt)}.` : "";
  return `${ahead ? `${ahead}, ` : ""}${stop.title} is at ${t(stop.start)}${spokenWhere(stop)}.${leave}`;
}
