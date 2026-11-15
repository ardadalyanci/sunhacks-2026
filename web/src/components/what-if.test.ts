import { describe, expect, it } from "vitest";
import type { ClassBlock, DayItem, DayPlan, PlanRequest, Weather } from "@/lib/types";
import {
  HOT_PREVIEW,
  NO_WHAT_IF,
  applyWhatIf,
  arizonaIso,
  baseNow,
  canOversleep,
  skipCandidate,
  wakeUp,
  whatIfCause,
} from "./what-if";

// Monday, Nov 16 2026.
const at = (hhmm: string) => `2026-11-16T${hhmm}:00-07:00`;
const REAL: Weather = { tempF: 78, highF: 84, isHot: false };
const classes: ClassBlock[] = [
  { course: "CSE 230", days: ["Mon", "Wed", "Fri"], start: "10:30", end: "11:20", location: "BYENG 210" },
  { course: "CSE 230", days: ["Tue"], start: "16:00", end: "17:00", location: "BYENG 210" }, // a lab, a different meeting
  { course: "CSE 240", days: ["Mon"], start: "15:00", end: "15:50", location: "BYENG 190" },
];
const sample: PlanRequest = { date: "2026-11-16", now: at("08:00"), classes, weather: REAL };
const real: PlanRequest = { date: "2026-11-16", classes, weather: REAL };

const item = (title: string, start: string, leaveAt?: string): DayItem => ({
  id: `class-${title}`,
  type: "class",
  title,
  start: at(start),
  leaveAt: leaveAt ? at(leaveAt) : undefined,
  source: "manual",
});
const plan = (...items: DayItem[]): DayPlan => ({ date: "2026-11-16", items, suggestions: [], briefing: "", aiUsed: false });

describe("baseNow", () => {
  it("uses the sample day's replayed moment, or the real clock in Arizona time", () => {
    expect(baseNow(sample, 0)).toBe(at("08:00"));
    expect(baseNow(real, Date.parse("2026-11-16T17:30:00Z"))).toBe(at("10:30"));
    expect(arizonaIso(Date.parse("2026-11-17T06:05:00Z"))).toBe(at("23:05"));
  });
});

describe("applyWhatIf", () => {
  it("changes nothing with every pill off", () => {
    expect(applyWhatIf(sample, REAL, NO_WHAT_IF, at("08:00"))).toEqual(sample);
    expect(applyWhatIf(real, REAL, NO_WHAT_IF, at("10:30")).now).toBeUndefined();
  });

  it("oversleeping plans the sample day from 9 am instead of 8 am", () => {
    const sent = applyWhatIf(sample, REAL, { ...NO_WHAT_IF, overslept: true }, baseNow(sample, 0));
    expect(sent.now).toBe(at("09:00"));
    expect(sample.now).toBe(at("08:00")); // the real request is left alone
  });

  it("oversleeping a real day sends the real time plus an hour", () => {
    const sent = applyWhatIf(real, REAL, { ...NO_WHAT_IF, overslept: true }, baseNow(real, Date.parse("2026-11-16T17:30:00Z")));
    expect(sent.now).toBe(at("11:30"));
  });

  it("oversleeping a real day before 8 am plans it from 9 am, not from the clock plus an hour", () => {
    const sent = applyWhatIf(real, REAL, { ...NO_WHAT_IF, overslept: true }, at("01:04"));
    expect(sent.now).toBe(at("09:00"));
  });

  it("never sends the calendar id while a pill is on, so a what-if day is not saved over the real one", () => {
    const saved: PlanRequest = { ...real, calendarId: "cal-1" };
    expect(applyWhatIf(saved, REAL, NO_WHAT_IF, at("08:00")).calendarId).toBe("cal-1");
    for (const whatIf of [
      { ...NO_WHAT_IF, hot: true },
      { ...NO_WHAT_IF, overslept: true },
      { ...NO_WHAT_IF, skipped: { course: "CSE 240", start: "15:00" } },
    ]) {
      expect(applyWhatIf(saved, REAL, whatIf, at("08:00"))).not.toHaveProperty("calendarId");
    }
    expect(saved.calendarId).toBe("cal-1"); // the real request keeps it
  });

  it("cancels only that meeting, and only on this weekday", () => {
    const sent = applyWhatIf(sample, REAL, { ...NO_WHAT_IF, skipped: { course: "CSE 230", start: "10:30" } }, at("08:00"));
    expect(sent.classes).toEqual([
      { ...classes[0], days: ["Wed", "Fri"] },
      classes[1],
      classes[2],
    ]);
    const once = applyWhatIf(sample, REAL, { ...NO_WHAT_IF, skipped: { course: "CSE 240", start: "15:00" } }, at("08:00"));
    expect(once.classes.map((c) => c.course)).toEqual(["CSE 230", "CSE 230"]);
    expect(sample.classes).toBe(classes);
  });

  it("heat swaps the weather, and switching it off restores the real one", () => {
    const hot = applyWhatIf(sample, REAL, { ...NO_WHAT_IF, hot: true }, at("08:00"));
    expect(hot.weather).toEqual(HOT_PREVIEW);
    expect(applyWhatIf(hot, REAL, NO_WHAT_IF, at("08:00")).weather).toEqual(REAL);
  });

  it("combines all three", () => {
    const sent = applyWhatIf(sample, REAL, { hot: true, overslept: true, skipped: { course: "CSE 240", start: "15:00" } }, at("08:00"));
    expect(sent).toMatchObject({ now: at("09:00"), weather: HOT_PREVIEW });
    expect(sent.classes.some((c) => c.course === "CSE 240")).toBe(false);
  });
});

describe("skipCandidate", () => {
  it("names the next class with a walk that has not started", () => {
    const day = plan(item("CSE 230", "10:30", "10:18"), item("CSE 240", "15:00", "14:52"));
    expect(skipCandidate(sample, day, at("08:00"))).toEqual({ course: "CSE 230", start: "10:30" });
    expect(skipCandidate(sample, day, at("10:30"))).toEqual({ course: "CSE 240", start: "15:00" });
    expect(skipCandidate(sample, day, at("16:00"))).toBeNull();
  });

  it("prefers a class with a leave time over an online one", () => {
    const day = plan(item("CSE 230", "10:30"), item("CSE 240", "15:00", "14:52"));
    expect(skipCandidate(sample, day, at("08:00"))?.course).toBe("CSE 240");
  });
});

describe("whatIfCause", () => {
  it("names the pill that changed", () => {
    expect(whatIfCause(NO_WHAT_IF, { ...NO_WHAT_IF, hot: true }, REAL, at("08:00"))).toEqual({ kind: "hot", on: true, hotF: 104, realF: 78 });
    expect(whatIfCause({ ...NO_WHAT_IF, overslept: true }, NO_WHAT_IF, REAL, at("08:00"))).toEqual({
      kind: "overslept",
      on: false,
      from: at("09:00"),
      to: at("08:00"),
    });
    const skipped = { course: "CSE 240", start: "15:00" };
    expect(whatIfCause(NO_WHAT_IF, { ...NO_WHAT_IF, skipped }, REAL, at("08:00"))).toEqual({ kind: "skip", on: true, course: "CSE 240" });
    expect(whatIfCause(NO_WHAT_IF, NO_WHAT_IF, REAL, at("08:00"))).toBeNull();
  });

  it("anchors oversleeping to the morning on a real day at 1 am: up at 9 instead of 8", () => {
    expect(whatIfCause(NO_WHAT_IF, { ...NO_WHAT_IF, overslept: true }, REAL, at("01:04"))).toEqual({
      kind: "overslept",
      on: true,
      from: at("08:00"),
      to: at("09:00"),
    });
    expect(whatIfCause(NO_WHAT_IF, { ...NO_WHAT_IF, overslept: true }, REAL, at("09:20"))).toMatchObject({
      from: at("09:20"),
      to: at("10:20"),
    });
  });
});

describe("wakeUp", () => {
  it("is 8 am on the planned day, or the clock when that is later", () => {
    expect(wakeUp("2026-11-16", at("01:04"))).toBe(at("08:00"));
    expect(wakeUp("2026-11-16", at("08:00"))).toBe(at("08:00"));
    expect(wakeUp("2026-11-16", at("09:20"))).toBe(at("09:20"));
  });
});

describe("canOversleep", () => {
  const day = plan(item("CSE 230", "10:30", "10:18"), item("CSE 240", "15:00", "14:52"));

  it("is offered before the day's first leave time", () => {
    expect(canOversleep(day, at("01:04"))).toBe(true);
    expect(canOversleep(day, at("08:00"))).toBe(true);
  });

  it("is not offered once the first leave time has passed", () => {
    expect(canOversleep(day, at("10:18"))).toBe(false);
    expect(canOversleep(day, at("10:40"))).toBe(false);
  });

  it("is not offered past 11 am, even on a day with no walks", () => {
    expect(canOversleep(plan(), at("10:59"))).toBe(true);
    expect(canOversleep(plan(), at("11:00"))).toBe(false);
  });

  it("is offered on a later day whatever the clock says", () => {
    expect(canOversleep(day, "2026-11-15T13:00:00-07:00")).toBe(true);
  });
});
