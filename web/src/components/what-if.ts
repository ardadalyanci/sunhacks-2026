// The "What if…" pills: heat, oversleeping and a cancelled class, as changes to the plan request.
// No React here, so the rules are easy to test. The student's real request is never changed; each re-plan
// sends a copy with the pills that are on applied to it.
import type { DayPlan, PlanRequest, Weather } from "@/lib/types";
import type { Cause } from "./plan-diff";
import { WEEKDAYS, parseLocal } from "./time";

/** One meeting of a class: its course and its local start time ("15:00"), as in ClassBlock. */
export type SkipKey = { course: string; start: string };

export type WhatIf = { hot: boolean; overslept: boolean; skipped: SkipKey | null };

export const NO_WHAT_IF: WhatIf = { hot: false, overslept: false, skipped: null };

export const HOT_PREVIEW: Weather = { tempF: 104, highF: 109, isHot: true }; // same as GET /api/demo?hot=1

const OVERSLEEP_MIN = 60;
const HOUR_MS = 3_600_000;
const WAKE_UP = "08:00"; // the planner's day starts here (DAY_START in lib/planner.ts), so the alarm does too
const LAST_OVERSLEEP_HOUR = 11; // past 11 am "What if I oversleep?" no longer makes sense on a real today

/** "2026-11-14T08:00:00-07:00" for a moment in ms: Arizona time, UTC-7 all year. */
export function arizonaIso(ms: number): string {
  return new Date(ms - 7 * HOUR_MS).toISOString().slice(0, 19) + "-07:00";
}

/** The day's "now" before any pill: the sample day's replayed moment, or the real clock. */
export function baseNow(request: PlanRequest, nowMs: number): string {
  return request.now ?? arizonaIso(nowMs);
}

const startOf = (iso: string) => iso.slice(11, 16); // "15:00" from "2026-11-14T15:00:00-07:00"

/**
 * The class a "What if it's cancelled?" pill names: the next class or commitment on the day that has not started
 * at `baseNowIso`, preferring one with a walk to it (a leave time), because that is the one a student would skip.
 */
export function skipCandidate(request: PlanRequest, plan: DayPlan, baseNowIso: string): SkipKey | null {
  const now = Date.parse(baseNowIso);
  const upcoming = plan.items.filter(
    (i) =>
      i.type === "class" &&
      Date.parse(i.start) > now &&
      request.classes.some((c) => c.course === i.title && c.start === startOf(i.start)),
  );
  const pick = upcoming.find((i) => i.leaveAt) ?? upcoming[0];
  return pick ? { course: pick.title, start: startOf(pick.start) } : null;
}

/**
 * When the student would have got up: 8:00 am on the planned day, or the plan's own clock when that is later
 * (the sample replays 8 am; a real day uses the clock). At 1 am the wake-up is still 8 am, not 1 am.
 */
export function wakeUp(date: string, baseNowIso: string): string {
  const morning = `${date}T${WAKE_UP}:00-07:00`;
  return Date.parse(baseNowIso) > Date.parse(morning) ? arizonaIso(Date.parse(baseNowIso)) : morning;
}

/** The wake-up an hour later: the plan's "now" while "What if I oversleep?" is on. */
const lateWakeUp = (date: string, baseNowIso: string) =>
  arizonaIso(Date.parse(wakeUp(date, baseNowIso)) + OVERSLEEP_MIN * 60_000);

/**
 * Whether "What if I oversleep?" still makes sense at `nowIso` (the plan's own clock): not once the day's first
 * leave time has passed, and not past 11 am on the planned day.
 */
export function canOversleep(plan: DayPlan, nowIso: string): boolean {
  const now = Date.parse(nowIso);
  if (parseLocal(nowIso).date === plan.date && parseLocal(nowIso).hours >= LAST_OVERSLEEP_HOUR) return false;
  const leaves = plan.items.flatMap((i) => (i.leaveAt ? [Date.parse(i.leaveAt)] : []));
  return !leaves.length || Math.min(...leaves) > now;
}

/** The PlanRequest to send: the student's real one with every pill that is on applied. */
export function applyWhatIf(
  baseRequest: PlanRequest,
  realWeather: Weather | undefined,
  whatIf: WhatIf,
  baseNowIso: string,
): PlanRequest {
  const request: PlanRequest = { ...baseRequest, weather: whatIf.hot ? HOT_PREVIEW : realWeather };
  if (whatIf.overslept) request.now = lateWakeUp(baseRequest.date ?? baseNowIso.slice(0, 10), baseNowIso);
  const skipped = whatIf.skipped;
  if (skipped) {
    // Only this day's meeting is cancelled: a MWF class keeps its Monday and Friday.
    const day = WEEKDAYS[parseLocal(baseRequest.date ?? baseNowIso.slice(0, 10)).dayIndex];
    request.classes = baseRequest.classes.flatMap((c) => {
      if (c.course !== skipped.course || c.start !== skipped.start || !c.days.includes(day)) return [c];
      const days = c.days.filter((d) => d !== day);
      return days.length ? [{ ...c, days }] : [];
    });
  }
  // A what-if day is never saved: /api/plan stores any day sent with a calendarId over the real one that the
  // subscribed calendar shows. With every pill off the id goes along again and the real day is saved.
  if (whatIf.hot || whatIf.overslept || whatIf.skipped) delete request.calendarId;
  return request;
}

/** Why the day is being re-planned when the pills go from `before` to `after`, for Sol's note on what changed. */
export function whatIfCause(
  before: WhatIf,
  after: WhatIf,
  realWeather: Weather | undefined,
  baseNowIso: string,
): Cause | null {
  if (before.hot !== after.hot) {
    return { kind: "hot", on: after.hot, hotF: HOT_PREVIEW.tempF, realF: realWeather?.tempF };
  }
  if (before.overslept !== after.overslept) {
    // The pills show only on today, so the clock's own date is the planned day.
    const date = baseNowIso.slice(0, 10);
    const usual = wakeUp(date, baseNowIso);
    const late = lateWakeUp(date, baseNowIso);
    return after.overslept
      ? { kind: "overslept", on: true, from: usual, to: late }
      : { kind: "overslept", on: false, from: late, to: usual };
  }
  const course = after.skipped?.course ?? before.skipped?.course;
  if (course && before.skipped?.course !== after.skipped?.course) {
    return { kind: "skip", on: after.skipped !== null, course };
  }
  return null;
}
