// How Sol names things out loud in the plan and command routes: courses, commitments, study time, events and
// days. The briefing and the "what's next" answers share these, so Sol calls a thing the same way everywhere.
import { placeLabel, spokenAssignment, spokenStop } from "./places";
import { addDays, mstDate, weekdayOf } from "./planner";
import type { DayItem } from "./types";

export const FULL_DAY: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

/** A course is exactly a course code ("CSE 230", "BIO 181L"). "MAT 343 study group" is a commitment. */
export function isCourse(title: string): boolean {
  return /^[A-Z]{2,4} \d{3}[A-Z]?$/.test(title.trim());
}

/** Lower-cases the first word unless it is an acronym or code ("Work shift" → "work shift", "MAT 343" stays). */
function lowerFirst(text: string): string {
  const first = text.split(/\s/)[0] ?? "";
  return first && first !== first.toUpperCase() ? text[0].toLowerCase() + text.slice(1) : text;
}

/**
 * An event the way a student says it to a friend: the part before a colon, with "the" ("Lunch & learn: landing a
 * software internship" → "the lunch & learn"). A title with capitalised names in it ("Sun Devil Robotics night")
 * keeps its capitals.
 */
export function spokenEvent(title: string): string {
  const short = title.split(":")[0].trim() || title.trim();
  const named = /\s[A-Z][a-z]/.test(short);
  const body = named ? short : lowerFirst(short);
  return /^the\s/i.test(body) ? body.replace(/^The\b/, "the") : `the ${body}`;
}

/**
 * Any timeline item as Sol says it: "CSE 230", "your work shift", "your MAT 343 study group",
 * "the Reading response for ENG 102" (a study block), "the robotics club build night".
 */
export function spokenItem(item: DayItem): string {
  if (item.type === "study_block") return spokenAssignment(item.title.replace(/^Work on:\s*/, ""));
  if (item.type === "event") return spokenEvent(item.title);
  if (isCourse(item.title)) return item.title.trim();
  return `your ${lowerFirst(spokenStop(item.title))}`;
}

/** Where it is: "in Brickyard 210" for a class, "at the MU" for anything else, "" without a place. */
export function spokenWhere(item: DayItem): string {
  if (!item.location) return "";
  return ` ${isCourse(item.title) ? "in" : "at"} ${placeLabel(item.location)}`;
}

/** How a reply about a later day opens: "Tomorrow" or "On Tuesday"; null for the same day as `nowMs`. */
export function dayOpener(iso: string, nowMs: number): string | null {
  const day = mstDate(new Date(iso));
  const today = mstDate(new Date(nowMs));
  if (day <= today) return null;
  return day === addDays(today, 1) ? "Tomorrow" : `On ${FULL_DAY[weekdayOf(day)]}`;
}

/**
 * Small repairs to a Gemini briefing before Sol says it. "now" never sits next to a clock time ("right now at
 * 8 am" says the same thing twice), and the stock openers the prompt bans but the model still slips in are cut
 * ("You can also check out the lunch & learn" → "Check out the lunch & learn"). Rejecting the whole briefing
 * instead would hand the student the plainer code briefing for a few filler words.
 */
export function tidyBriefing(text: string): string {
  return text
    .replace(/\s*\b(?:right\s+)?now,?\s+(?=(?:at|by)\s+\d|\d)/gi, " ")
    .replace(/\b(?:you can also|you'll want to|you will want to)\s+/gi, "")
    .replace(/\byou've got\b/gi, (m) => (m[0] === "Y" ? "You have" : "you have"))
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/(^|[.?]\s+)([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
}
