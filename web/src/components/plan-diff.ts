// What changed between two plans of the same day, and Sol's one or two sentences about it.
// No React here, so the rules are easy to test. Everything is read from the real plans, never assumed.
import { placeLabel } from "@/lib/places";
import type { DayItem, DayPlan } from "@/lib/types";
import { assignmentName, rangeLabel } from "./sky-layout";
import { formatDay, formatTime, parseLocal } from "./time";

/** Why the day was planned again. */
export type Cause =
  | { kind: "hot"; on: boolean; hotF: number; realF?: number } // the "What if it's 104°?" pill
  | { kind: "overslept"; on: boolean; from: string; to: string } // ISO wake-up times, before and after
  | { kind: "skip"; on: boolean; course: string } // a class cancelled (on) or back (off)
  | { kind: "added"; id: string } // an event put on the day
  | { kind: "removed"; id: string }; // an event taken off the day

type Range = { start: string; end: string };

/** A class, event or deadline (one item), or every study block for one assignment (a group). */
export type Moved = { type: DayItem["type"]; title: string; before: Range[]; after: Range[] };
export type LeaveChange = { item: DayItem; before: string; after: string };

export type PlanDiff = {
  added: DayItem[]; // classes, events and deadlines only on the new plan
  removed: DayItem[]; // ...and only on the old one
  moved: Moved[]; // items and study groups whose times changed, including study placed or dropped
  leave: LeaveChange[]; // classes and events whose leave time changed
};

// Classes and events are identified by type and title (a second one with the same title gets "#2"), because
// the planner renumbers ids. Study blocks are grouped by their title, which names the assignment.
function keyed(items: DayItem[]) {
  const singles = new Map<string, DayItem>();
  const groups = new Map<string, Range[]>();
  for (const i of items) {
    if (i.type === "study_block") {
      groups.set(i.title, [...(groups.get(i.title) ?? []), { start: i.start, end: i.end ?? i.start }]);
      continue;
    }
    let key = `${i.type}|${i.title}`;
    for (let n = 2; singles.has(key); n++) key = `${i.type}|${i.title}#${n}`;
    singles.set(key, i);
  }
  return { singles, groups };
}

const sameRanges = (a: Range[], b: Range[]) =>
  a.length === b.length && a.every((r, i) => r.start === b[i].start && r.end === b[i].end);

export function diffPlans(before: DayPlan, after: DayPlan): PlanDiff {
  const a = keyed(before.items);
  const b = keyed(after.items);
  const diff: PlanDiff = { added: [], removed: [], moved: [], leave: [] };
  const range = (i: DayItem): Range[] => [{ start: i.start, end: i.end ?? i.start }];

  for (const [key, old] of a.singles) {
    const now = b.singles.get(key);
    if (!now) {
      diff.removed.push(old);
      continue;
    }
    if (old.start !== now.start || (old.end ?? "") !== (now.end ?? "")) {
      diff.moved.push({ type: now.type, title: now.title, before: range(old), after: range(now) });
    }
    if (old.leaveAt && now.leaveAt && old.leaveAt !== now.leaveAt) {
      diff.leave.push({ item: now, before: old.leaveAt, after: now.leaveAt });
    }
  }
  for (const [key, now] of b.singles) if (!a.singles.has(key)) diff.added.push(now);

  for (const title of new Set([...a.groups.keys(), ...b.groups.keys()])) {
    const was = a.groups.get(title) ?? [];
    const is = b.groups.get(title) ?? [];
    if (!sameRanges(was, is)) diff.moved.push({ type: "study_block", title, before: was, after: is });
  }
  return diff;
}

const clock = (iso: string) => formatTime(parseLocal(iso).hours);
const span = (r: Range) => rangeLabel(parseLocal(r.start).hours, parseLocal(r.end).hours);
const spans = (rs: Range[]) => rs.map(span).join(" and ");
const where = (i: DayItem) => placeLabel(i.location) || i.title;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const minutes = (n: number) => `${n} minute${n === 1 ? "" : "s"}`;
const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end; // same-day ISO strings sort by time

/** "Lab 7" or "the Reading response", from a study block's "Work on: CSE 230: Lab 7 (pipelining)". */
function studyName(blockTitle: string) {
  const name = assignmentName(blockTitle.replace(/^Work on:\s*/, ""));
  return /\d$/.test(name) ? name : `the ${name}`;
}

/** "noon", "noon tomorrow" or "noon Tuesday": when an assignment is due, from the planned day's point of view. */
function dueText(dueIso: string, date: string) {
  const time = clock(dueIso);
  const day = parseLocal(dueIso).date;
  if (day === date) return time;
  const next = new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return `${time} ${day === next ? "tomorrow" : formatDay(day).split(",")[0]}`;
}

type Context = {
  now?: string; // the planned "now", so "you still leave at…" names the next walk, not one already past
  deadlines?: DayItem[]; // so a study block that no longer fits can say when its assignment is due
};

/** One clause per study change, most important first: what no longer fits, then what moved, then what is new. */
function studyFacts(diff: PlanDiff, after: DayPlan, deadlines: DayItem[]): { text: string; group: Moved }[] {
  const groups = diff.moved.filter((m) => m.type === "study_block");
  const gone = groups
    .filter((g) => g.after.length === 0)
    .map((group) => {
      const due = deadlines.find((d) => group.title === `Work on: ${d.title}`);
      const until = due ? ` before it's due at ${dueText(due.start, after.date)}` : " today";
      return { text: `there's no room left for ${studyName(group.title)}${until}`, group };
    });
  const moved = groups
    .filter((g) => g.before.length > 0 && g.after.length > 0)
    .map((group) => {
      const name = studyName(group.title);
      // Same blocks starting at the same times: only an end moved (heat makes the walk after it start earlier).
      const trimmed =
        group.before.length === group.after.length && group.before.every((r, i) => r.start === group.after[i].start);
      const k = group.after.findIndex((r, i) => r.end !== group.before[i]?.end);
      if (trimmed && k >= 0) {
        const end = group.after[k].end;
        const text = end < group.before[k].end ? `I stop ${name} at ${clock(end)}` : `I let ${name} run to ${clock(end)}`;
        return { text, group };
      }
      return { text: `I moved ${name} to ${spans(group.after)}`, group };
    });
  const placed = groups
    .filter((g) => g.before.length === 0)
    .map((group) => ({ text: `I put ${studyName(group.title)} at ${spans(group.after)}`, group }));
  return [...gone, ...moved, ...placed];
}

/** "you still leave at 9:47 am for the MU": the next walk on the new plan, compared with the old one. */
function walkLine(before: DayPlan, after: DayPlan, now?: string): string | null {
  const from = now ? Date.parse(now) : -Infinity;
  const next = after.items.find((i) => i.leaveAt && Date.parse(i.leaveAt) >= from);
  if (!next?.leaveAt) return null;
  const was = before.items.find((i) => i.type === next.type && i.title === next.title && i.start === next.start);
  const at = `${clock(next.leaveAt)} for ${where(next)}`;
  if (!was?.leaveAt) return `your next walk is at ${at}`;
  return was.leaveAt === next.leaveAt ? `you still leave at ${at}` : `you now leave at ${at}`;
}

const isEmpty = (d: PlanDiff) => !d.added.length && !d.removed.length && !d.moved.length && !d.leave.length;

/** Two sentences at most: a lead with its first detail, then one more detail if there is one. */
function say(first: string, second?: string | null) {
  const text = second ? `${first}. ${capital(second)}.` : `${first}.`;
  return text.replace(/\b12 pm\b/g, "noon"); // the app says "noon", not "12 pm"
}

/**
 * Sol's note on what a re-plan changed and what it did not, e.g. "Up at 9 am instead of 8 am: I moved Lab 7 to
 * 2–3:13 pm. You still leave at 9:47 am for the MU."
 */
export function describeChange(cause: Cause, before: DayPlan, after: DayPlan, context: Context = {}): string {
  const diff = diffPlans(before, after);
  const deadlines = [...(context.deadlines ?? []), ...before.items, ...after.items].filter((i) => i.type === "deadline");
  const study = studyFacts(diff, after, deadlines);
  const walk = walkLine(before, after, context.now);
  const nothing = isEmpty(diff);

  switch (cause.kind) {
    case "hot": {
      const shifts = diff.leave.map((l) => Math.round((Date.parse(l.after) - Date.parse(l.before)) / 60_000));
      const even = shifts.length > 0 && shifts.every((s) => s === shifts[0]) ? Math.abs(shifts[0]) : null;
      if (cause.on) {
        if (nothing) return say(`It's ${cause.hotF}° now`, "nothing had to move");
        const lead = shifts.length
          ? `${cause.hotF}° out, so I start every walk ${even ? minutes(even) : "a few minutes"} earlier`
          : `It's ${cause.hotF}° now`;
        const detail = shifts.length && walk ? (study[0] ? `${walk}, and ${study[0].text}` : walk) : study[0]?.text;
        return say(lead, detail);
      }
      const back = cause.realF === undefined ? "Back to today's real weather" : `Back to ${Math.round(cause.realF)}°`;
      if (nothing) return say(back, "nothing had to move");
      const lead = shifts.length
        ? `${back}: your walks are ${even ? minutes(even) : "a few minutes"} later again`
        : `${back}: ${study[0]?.text ?? "your walks didn't change"}`;
      return say(lead, shifts.length ? study[0]?.text : study[1]?.text);
    }

    case "overslept": {
      const lead = cause.on
        ? `Up at ${clock(cause.to)} instead of ${clock(cause.from)}`
        : `Back to starting at ${clock(cause.to)}`;
      if (nothing || !study.length) return say(`${lead}: nothing had to move`, walk);
      return say(`${lead}: ${study[0].text}`, study[1]?.text ?? walk);
    }

    case "skip": {
      if (cause.on) {
        const gone = diff.removed.find((i) => i.type === "class" && i.title === cause.course);
        const lead = `No ${cause.course} today`;
        if (!gone) return say(lead, "nothing had to move");
        const freed: Range = { start: gone.start, end: gone.end ?? gone.start };
        const filler = study.find((f) => f.group.after.some((r) => overlaps(r, freed)));
        const first = filler
          ? `${lead}: that frees ${span(freed)}, and I put ${studyName(filler.group.title)} there`
          : `${lead}: that frees ${span(freed)}`;
        const rest = study.filter((f) => f !== filler);
        // The next walk is worth a word only when the cancelled class changed it.
        return say(first, rest[0]?.text ?? (walk?.startsWith("you still") ? null : walk));
      }
      const lead = `${cause.course} is back on`;
      return say(`${lead}: ${study[0]?.text ?? walk ?? "nothing else moved"}`, study[0] ? (study[1]?.text ?? walk) : null);
    }

    case "added": {
      const event = after.items.find((i) => i.id === cause.id);
      if (!event) return "That event doesn't fit in your day, so nothing moved.";
      const when = span({ start: event.start, end: event.end ?? event.start });
      const leave = event.leaveAt ? `, so leave at ${clock(event.leaveAt)} for ${where(event)}` : "";
      const others = diff.leave.filter((l) => l.item.id !== cause.id);
      const detail = study[0]?.text ?? (others[0] ? `you now leave at ${clock(others[0].after)} for ${where(others[0].item)}` : null);
      return say(`Added ${event.title}, ${when}${leave}`, detail ?? "nothing else moved");
    }

    case "removed": {
      const event = before.items.find((i) => i.id === cause.id);
      const lead = `Took ${event?.title ?? "that event"} off your day`;
      const others = diff.leave.filter((l) => l.item.id !== cause.id);
      const detail = study[0]?.text ?? (others[0] ? `you now leave at ${clock(others[0].after)} for ${where(others[0].item)}` : null);
      return say(lead, detail ?? "nothing else moved");
    }
  }
}
