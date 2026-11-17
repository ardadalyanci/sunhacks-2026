import { untilText } from "./next-walk";
import { parseLocal } from "./time";

export type Urgency = "overdue" | "today" | "tomorrow" | "later";

const HOUR = 3_600_000;

/**
 * How pressing one open assignment is, for the Due soon cards: overdue, due today, due tomorrow or later, and the
 * time left ("15 h 59 min left" within two days, else "3 days left"). `nowMs` is 0 before the clock is known; the
 * time left is then empty and the urgency goes by the date alone.
 */
export function dueStatus(dueIso: string, nowMs: number, today: string, tomorrow: string): { urgency: Urgency; left: string } {
  const dueMs = Date.parse(dueIso);
  const date = parseLocal(dueIso).date;
  if (nowMs && dueMs <= nowMs) return { urgency: "overdue", left: "Overdue" };
  const urgency: Urgency = date <= today ? "today" : date === tomorrow ? "tomorrow" : "later";
  if (!nowMs) return { urgency, left: "" };
  const ms = dueMs - nowMs;
  const left = ms < 48 * HOUR ? `${untilText(ms)} left` : `${Math.floor(ms / (24 * HOUR))} days left`;
  return { urgency, left };
}

/** "CSE 230: Lab 7 (pipelining)" → { course: "CSE 230", task: "Lab 7 (pipelining)" }; no course when there is no code. */
export function splitCourse(title: string): { course?: string; task: string } {
  const match = /^([A-Z]{2,4} \d{3}[A-Z]?):\s*(.+)$/.exec(title.trim());
  return match ? { course: match[1], task: match[2] } : { task: title };
}
