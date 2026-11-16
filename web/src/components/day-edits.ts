// Edits the student made to one day by chatting with Sol: blocks of their own ("Gym, 5 to 6 pm"), classes skipped
// today, and "no study time before 3:50 pm". Kept in this browser per day and applied to the plan request, so a
// reload, another tab of the day or the Events page all see them. The saved class list in Setup never changes.
import { weekdayOf } from "@/lib/planner";
import type { ClassBlock } from "@/lib/types";

export type AddedBlock = { title: string; start: string; end: string; location?: string }; // "17:00", "18:00"
export type DayEdits = { add: AddedBlock[]; skip: string[]; studyFrom?: string };

const KEY = "daypilot.edits";
const KEEP_DAYS = 14;
export const NO_EDITS: DayEdits = { add: [], skip: [] };

function readAll(): Record<string, DayEdits> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown;
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, DayEdits>) : {};
  } catch {
    return {};
  }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;

/** The edits for `date`, with anything malformed dropped. */
export function loadEdits(date: string): DayEdits {
  const e = readAll()[date] as Partial<DayEdits> | undefined;
  if (!e || typeof e !== "object") return NO_EDITS;
  const add = Array.isArray(e.add)
    ? e.add.filter((b): b is AddedBlock => Boolean(b) && isText(b.title, 60) && HHMM.test(b.start) && HHMM.test(b.end) && b.end > b.start)
    : [];
  const skip = Array.isArray(e.skip) ? e.skip.filter((c): c is string => isText(c, 60)) : [];
  return { add, skip, ...(typeof e.studyFrom === "string" && HHMM.test(e.studyFrom) ? { studyFrom: e.studyFrom } : {}) };
}

/** Saves the edits for `date` (an empty one is removed) and forgets days more than two weeks old. */
export function saveEdits(date: string, edits: DayEdits) {
  try {
    const all = readAll();
    const empty = !edits.add.length && !edits.skip.length && !edits.studyFrom;
    if (empty) delete all[date];
    else all[date] = edits;
    const days = Object.keys(all).sort();
    for (const d of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) delete all[d];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage blocked: the edit still applies to this plan, it just isn't remembered
  }
}

/** "17:00" plus 90 minutes → "18:30", never past 23:59. */
export function endAfter(start: string, minutes: number): string {
  const [h, m] = start.split(":").map(Number);
  const end = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The day's classes with today's edits: skipped ones out, the student's own blocks in (as one-day commitments). */
export function withEdits(classes: ClassBlock[], edits: DayEdits, date: string): ClassBlock[] {
  const day = weekdayOf(date);
  const kept = classes.filter((c) => !(c.days.includes(day) && edits.skip.some((s) => same(s, c.course))));
  const added = edits.add.map((b): ClassBlock => ({ course: b.title, days: [day], start: b.start, end: b.end, ...(b.location ? { location: b.location } : {}) }));
  return [...kept, ...added];
}

/** True when `title` is a block the student added today (taking it off removes it instead of skipping it). */
export const isAdded = (edits: DayEdits, title: string) => edits.add.some((b) => same(b.title, title));
