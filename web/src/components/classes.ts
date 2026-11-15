// Checks for the class rows on the setup screen. No React here, so the rules are easy to test.
import type { ClassBlock } from "@/lib/types";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A row the student added but never filled in. Saving skips it. */
export function isBlankClass(c: ClassBlock): boolean {
  return !c.course.trim() && c.days.length === 0 && !c.location?.trim();
}

/** What the student has to fix in a class row, or "" when it is ready to save. */
export function classProblem(c: ClassBlock): string {
  if (!c.course.trim()) return "Add the course, like CSE 240.";
  if (c.days.length === 0) return "Pick the days it meets.";
  if (!TIME.test(c.start) || !TIME.test(c.end)) return "Add a start and an end time.";
  if (c.start >= c.end) return "The end time has to be after the start time.";
  return "";
}
