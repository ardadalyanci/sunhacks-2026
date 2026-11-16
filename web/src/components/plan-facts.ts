// The steps of "How Sol planned this day": what each part of the engine did for this exact day, with the real
// numbers from the request and the plan. No React here, so every sentence is easy to test.
import buildings from "@/lib/buildings.json";
import { findPlace, placeLabel } from "@/lib/places";
import type { DayItem, DayPlan, PlanRequest } from "@/lib/types";
import { interestLabel, INTEREST_CHIPS } from "./interests";
import { untilText } from "./next-walk";
import { assignmentName, hourOn, rangeLabel } from "./sky-layout";
import { arizonaToday, formatDay, formatTime, parseLocal } from "./time";
import { walkLegs } from "./walk-map";

export type PlanFact = { key: string; label: string; text: string };
export type Source = { name: string; url: string };

type Options = { isDemo: boolean; later: boolean };

// The heat preview ("What if it's 104°F?") sends these made-up numbers instead of the forecast
// (HOT_PREVIEW in what-if.ts, the hot sample in lib/demo.ts), so they are not Open-Meteo's.
const PREVIEW_HEAT = { tempF: 104, highF: 109 };

// The fallback ranking (rankByOverlap in lib/planner.ts) writes "You picked robotics."; Gemini is told never to
// start a reason that way, so this tells the two apart.
const RULES_WHY = /^You picked /;

// A class is a title that is exactly a course code ("CSE 230", "BIO 181L"); "MAT 343 study group" is not.
const COURSE = /^[A-Z]{2,4} \d{3}[A-Z]?$/;

const MAX_DUE_LISTED = 3; // a long Canvas list reads as "and 4 more"

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "A", "A and B", "A, B and C". */
function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "11:59 pm", "8 am", "noon". */
function clockText(iso: string): string {
  const time = formatTime(parseLocal(iso).hours);
  return time === "12 pm" ? "noon" : time;
}

const weekday = (date: string) => formatDay(date).split(",")[0];

/** Arizona date of any ISO time, whatever offset it was written with. */
const azDate = (iso: string) => arizonaToday(Date.parse(iso));

/** When an assignment is due, said from the planned day: "tonight", "tomorrow", or the weekday. */
function dueWhen(iso: string, date: string, later: boolean): string {
  const due = azDate(iso);
  const at = `at ${clockText(iso)}`;
  if (!later && due === date) return `${parseLocal(iso).hours >= 17 ? "tonight" : "today"} ${at}`;
  if (!later && due === arizonaToday(Date.parse(`${date}T12:00:00-07:00`) + 86_400_000)) return `tomorrow ${at}`;
  return `${weekday(due)} ${at}`;
}

/** An interest in the words the chips use, lowercased mid-sentence ("cultural nights" for "cultural"). */
function interestWord(key: string): string {
  const known = INTEREST_CHIPS.some((c) => c.key === key.toLowerCase());
  return known ? interestLabel(key).toLowerCase() : key;
}

/** A class by its code ("CSE 230"); anything else as "your work shift" or "your MAT 343 study group". */
function scheduleName(title: string): string {
  if (COURSE.test(title)) return title;
  return `your ${/^[A-Z][a-z]/.test(title) ? title[0].toLowerCase() + title.slice(1) : title}`;
}

function scheduleFact(plan: DayPlan): PlanFact | null {
  const fixed = plan.items.filter((i) => i.type === "class");
  if (!fixed.length) return null;
  const allCourses = fixed.every((i) => COURSE.test(i.title));
  const kind = allCourses ? plural(fixed.length, "class", "classes") : plural(fixed.length, "thing");
  return {
    key: "schedule",
    label: "Your schedule",
    text: `${kind} on ${weekday(plan.date)}: ${joinList(fixed.map((i) => scheduleName(i.title)))}.`,
  };
}

function canvasFact(request: PlanRequest, plan: DayPlan, { isDemo, later }: Options): PlanFact | null {
  const all = (request.deadlines ?? []).filter((d) => d.type === "deadline");
  if (!all.length) {
    if (isDemo) return null;
    // Without the token we cannot tell "not connected" from "nothing due", so the sentence covers both honestly.
    return {
      key: "canvas",
      label: "Canvas",
      text: "No assignments came back from Canvas for this day. If you haven't connected it yet, add your token in Setup.",
    };
  }
  const done = all.filter((d) => d.done).length;
  const open = all.filter((d) => !d.done).sort((a, b) => a.start.localeCompare(b.start));
  const parts: string[] = [];
  if (done) parts.push(done === all.length ? `all ${done} turned in` : `${done} turned in`);
  for (const d of open.slice(0, MAX_DUE_LISTED)) parts.push(`${assignmentName(d.title)} due ${dueWhen(d.start, plan.date, later)}`);
  if (open.length > MAX_DUE_LISTED) parts.push(`${open.length - MAX_DUE_LISTED} more still due`);
  const head = isDemo ? plural(all.length, "sample assignment") : `${plural(all.length, "assignment")} from Canvas`;
  return { key: "canvas", label: isDemo ? "Assignments" : "Canvas", text: `${head}: ${joinList(parts)}.` };
}

const walkMinutes = (i: DayItem) => Math.round((Date.parse(i.start) - Date.parse(i.leaveAt!)) / 60_000);

/**
 * The walks, counted the way the "Your walks" map draws them (walkLegs), so both cards give the same numbers. The
 * map has no line for the walk to the first stop when the day's start is unknown, so that one is named apart.
 */
function walksFact(request: PlanRequest, plan: DayPlan): PlanFact | null {
  const walks = plan.items
    .filter((i) => (i.type === "class" || i.type === "event") && i.leaveAt && parseLocal(i.start).date === plan.date)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  if (!walks.length) return null;
  const { legs } = walkLegs(plan.items, plan.date, request.startBuildingId);
  const source = `Each leave time comes from distances between ${buildings.length} ASU buildings from OpenStreetMap.`;
  // No map at all (one stop, or only places the map does not know): count the plan's own walks.
  if (!legs.length) {
    const onFoot = walks.filter((i) => !i.via); // a shuttle ride or the trip from home is not on foot
    if (!onFoot.length) return null;
    const minutes = onFoot.reduce((sum, i) => sum + walkMinutes(i), 0);
    return { key: "walks", label: "Walks", text: `${plural(onFoot.length, "walk")}, ${plural(minutes, "minute")} on foot in all. ${source}` };
  }
  const minutes = legs.reduce((sum, leg) => sum + leg.minutes, 0);
  const start = findPlace(request.startBuildingId).building ? `, starting from ${placeLabel(request.startBuildingId)}` : "";
  const first = walks[0];
  const plus =
    legs.some((leg) => leg.itemId === first.id) || first.via
      ? ""
      : `, plus the walk to your first ${first.type === "event" ? "event" : "class"}`;
  return {
    key: "walks",
    label: "Walks",
    text: `${plural(legs.length, "walk")}, ${plural(minutes, "minute")} on foot in all${start}${plus}. ${source}`,
  };
}

function weatherFact(request: PlanRequest, plan: DayPlan, { isDemo, later }: Options): PlanFact | null {
  const w = plan.weather ?? request.weather;
  if (!w) return null;
  const preview = w.isHot && w.tempF === PREVIEW_HEAT.tempF && w.highF === PREVIEW_HEAT.highF;
  const numbers = later
    ? `a high of ${Math.round(w.highF)}°F`
    : `${Math.round(w.tempF)}°F now and a high of ${Math.round(w.highF)}°F`;
  const source = preview
    ? `The heat preview is on, so this is a made-up hot day: ${numbers}.`
    : isDemo
      ? `Sample weather: ${numbers}.`
      : `Open-Meteo says ${numbers}${later ? ` on ${weekday(plan.date)}` : ""}.`;
  const heat = w.isHot ? " It's a hot day, so I added extra minutes to every walk." : "";
  return { key: "weather", label: "Weather", text: source + heat };
}

function studyFact(plan: DayPlan): PlanFact | null {
  const blocks = plan.items.filter((i) => i.type === "study_block" && i.end);
  if (!blocks.length) return null;
  // Blocks for one assignment share its title ("Work on: CSE 230: Lab 7 (pipelining)"), in time order.
  const byTitle = new Map<string, DayItem[]>();
  for (const b of [...blocks].sort((x, y) => x.start.localeCompare(y.start))) {
    byTitle.set(b.title, [...(byTitle.get(b.title) ?? []), b]);
  }
  const parts = [...byTitle].map(([title, list]) => {
    const ms = list.reduce((sum, b) => sum + Date.parse(b.end!) - Date.parse(b.start), 0);
    const times = list.map((b) => rangeLabel(hourOn(b.start, plan.date), hourOn(b.end!, plan.date)));
    return `${assignmentName(title.replace(/^Work on:\s*/, ""))}: ${untilText(ms)}, ${joinList(times)}`;
  });
  return {
    key: "study",
    label: "Study time",
    text: `${parts.join("; ")}. ${parts.length === 1 ? "It sits" : "Each sits"} in free time before it's due.`,
  };
}

/** True when the suggestions came from Gemini's ranking, false when plain rules ranked them, null when unknown. */
function rankedByGemini(plan: DayPlan): boolean | null {
  if (!plan.suggestions.length) return null;
  return !plan.suggestions.every((s) => RULES_WHY.test(s.why ?? ""));
}

function eventsFact(request: PlanRequest, plan: DayPlan, { isDemo }: Options): PlanFact | null {
  const events = request.events ?? [];
  if (!events.length) {
    return isDemo ? null : { key: "events", label: "Events", text: "No events came back from the ASU feeds this time." };
  }
  const onDay = events.filter((e) => e.startsAt && azDate(e.startsAt) === plan.date).length;
  const live = events.filter((e) => e.source !== "seed").length;
  const samples = events.length - live; // the sample student's made-up events, only on the sample's today
  const week =
    isDemo && samples && live
      ? `${plural(samples, "sample event")} mixed with ${live} from the live ASU feeds this week`
      : isDemo && samples
        ? plural(samples, "sample event")
        : `${plural(events.length, "event")} this week from ASU Events and Sun Devil Central`;
  const added = plan.items.filter((i) => i.type === "event").length;
  const suggest = plan.suggestions.length
    ? ` I picked ${plan.suggestions.length} for you.`
    : onDay > added
      ? ` None of ${added ? "the others" : "them"} fits both your free time and your interests.`
      : "";
  const counts = `${week}, ${onDay || "none"} on ${weekday(plan.date)}.${added ? ` You added ${added}.` : ""}${suggest}`;
  const interests = (request.interests ?? []).map(interestWord);
  const against = interests.length ? `against your interests: ${joinList(interests)}` : "with no interests picked yet";
  const ranker = rankedByGemini(plan);
  const how =
    ranker === null
      ? ""
      : ` ${ranker ? "Gemini" : "Plain rules"} ranked the ones that fit your free time ${against}.`;
  return { key: "events", label: "Events", text: counts + how };
}

function whoFact(request: PlanRequest, plan: DayPlan): PlanFact {
  if (!plan.aiUsed) {
    return { key: "who", label: "Who did what", text: "Gemini was not reachable, so plain rules did everything, including my words." };
  }
  // Only claim the Gemini steps that ran for this day.
  const jobs = ["wrote my words"];
  if (rankedByGemini(plan)) jobs.push("ranked the events");
  if ((request.deadlines ?? []).some((d) => d.type === "deadline" && !d.done)) jobs.push("estimated how long your homework takes");
  return {
    key: "who",
    label: "Who did what",
    text: `Gemini ${joinList(jobs)}. Plain code did the math: free gaps, walks, heat and where each block goes.`,
  };
}

/** The steps, in the order the planner runs them. A step with nothing true to say is left out. */
export function planFacts(request: PlanRequest, plan: DayPlan, options: Options): PlanFact[] {
  const facts = [
    scheduleFact(plan),
    canvasFact(request, plan, options),
    walksFact(request, plan),
    weatherFact(request, plan, options),
    studyFact(plan),
    eventsFact(request, plan, options),
    whoFact(request, plan),
    plan.calendarUrl
      ? { key: "saved", label: "Saved", text: "This day is saved in MongoDB Atlas, so your calendar app can subscribe to it." }
      : null,
  ];
  return facts.filter((f): f is PlanFact => f !== null);
}

/** Where the data came from, as links. Atlas only when this day was saved there. */
export function planSources(plan: DayPlan): Source[] {
  const sources: Source[] = [
    { name: "Canvas API", url: "https://canvas.instructure.com/doc/api/" },
    { name: "ASU Events", url: "https://asuevents.asu.edu/" },
    { name: "Sun Devil Central", url: "https://sundevilcentral.eoss.asu.edu/" },
    { name: "Open-Meteo", url: "https://open-meteo.com/" },
    { name: "OpenStreetMap", url: "https://www.openstreetmap.org/" },
    { name: "Gemini API", url: "https://ai.google.dev/gemini-api" },
  ];
  if (plan.calendarUrl) sources.push({ name: "MongoDB Atlas", url: "https://www.mongodb.com/products/platform/atlas-database" });
  return sources;
}
