import { describe, expect, it } from "vitest";
import { isCalendarDate, sanitizePlanForCommand, sanitizePlanRequest } from "./sanitize";

describe("isCalendarDate", () => {
  it.each([
    ["2026-11-16", true],
    ["2028-02-29", true],
    ["2026-02-30", false],
    ["2026-13-01", false],
    ["16-11-2026", false],
    [20261116, false],
  ])("%s → %s", (v, ok) => expect(isCalendarDate(v)).toBe(ok));
});

describe("sanitizePlanRequest", () => {
  it("rejects a body without a classes array", () => {
    expect(sanitizePlanRequest(null).ok).toBe(false);
    expect(sanitizePlanRequest({}).ok).toBe(false);
    expect(sanitizePlanRequest({ classes: "CSE 230" }).ok).toBe(false);
  });

  it("drops broken entries instead of failing", () => {
    const res = sanitizePlanRequest({
      date: "2026-02-30",
      now: "not a date",
      classes: [
        { course: "CSE 230", days: ["Mon", "Funday"], start: "10:30", end: "11:20", location: "BYENG 210" },
        { course: "No days", days: [], start: "10:00", end: "11:00" },
        { course: "Bad time", days: ["Mon"], start: "1:30 PM", end: "2:45 PM" },
        { course: "Ends first", days: ["Mon"], start: "12:00", end: "11:00" },
        { days: ["Mon"], start: "10:00", end: "11:00" },
        null,
      ],
      deadlines: [
        { id: "d1", type: "deadline", title: "Lab", start: "2026-11-16T23:59:00-07:00", done: true, url: "javascript:alert(1)" },
        { id: "d2", type: "deadline", title: "Bad", start: "tbd" },
        "nope",
      ],
      events: [{ id: "e1", title: "Robotics", startsAt: "2026-11-16T16:00:00-07:00", tags: ["robotics", 5] }, { id: "e2", title: "No time" }, null],
      acceptedEventIds: ["e1", 5, null],
      interests: "robotics",
      weather: { tempF: "hot", highF: 100 },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const v = res.value;
    expect(v.date).toBeUndefined();
    expect(v.now).toBeUndefined();
    expect(v.classes).toEqual([{ course: "CSE 230", days: ["Mon"], start: "10:30", end: "11:20", location: "BYENG 210" }]);
    expect(v.deadlines).toEqual([{ id: "d1", type: "deadline", title: "Lab", start: "2026-11-16T23:59:00-07:00", source: "canvas", done: true, url: undefined }]);
    expect(v.events?.map((e) => [e.id, e.tags])).toEqual([["e1", ["robotics"]]]);
    expect(v.acceptedEventIds).toEqual(["e1"]);
    expect(v.interests).toEqual([]);
    expect(v.weather).toBeUndefined();
  });

  it("keeps the walking pace only when it is exactly \"slower\"", () => {
    const pace = (v: unknown) => {
      const res = sanitizePlanRequest({ classes: [], pace: v });
      return res.ok ? res.value.pace : "rejected";
    };
    expect(pace("slower")).toBe("slower");
    expect(pace("faster")).toBeUndefined();
    expect(pace("Slower")).toBeUndefined();
    expect(pace(true)).toBeUndefined();
    expect(pace(undefined)).toBeUndefined();
  });

  it("keeps an off-campus commute only with whole minutes from 1 to 120 and a known way to travel", () => {
    const commute = (v: unknown) => {
      const res = sanitizePlanRequest({ classes: [], commute: v });
      return res.ok ? res.value.commute : "rejected";
    };
    expect(commute({ minutes: 25, by: "drive" })).toEqual({ minutes: 25, by: "drive" });
    expect(commute({ minutes: 12.4, by: "bike" })).toEqual({ minutes: 12, by: "bike" });
    expect(commute({ minutes: 500, by: "bus" })).toEqual({ minutes: 120, by: "bus" });
    expect(commute({ minutes: 0, by: "walk" })).toEqual({ minutes: 1, by: "walk" });
    expect(commute({ minutes: "25", by: "drive" })).toBeUndefined();
    expect(commute({ minutes: 25, by: "helicopter" })).toBeUndefined();
    expect(commute({ minutes: Number.NaN, by: "drive" })).toBeUndefined();
    expect(commute(undefined)).toBeUndefined();
    // A home point in the Phoenix area, rounded to about 100 m; minutes are then optional.
    expect(commute({ by: "bike", home: { lat: 33.43164, lng: -111.94526 } })).toEqual({ by: "bike", home: { lat: 33.432, lng: -111.945 } });
    expect(commute({ by: "bike", home: { lat: 32.22, lng: -110.97 } })).toBeUndefined(); // Tucson
    expect(commute({ by: "bike", home: { lat: "33.4", lng: -111.9 } })).toBeUndefined();
  });

  it("derives isHot when it is missing", () => {
    const res = sanitizePlanRequest({ classes: [], weather: { tempF: 90, highF: 101 } });
    expect(res.ok && res.value.weather).toEqual({ tempF: 90, highF: 101, isHot: true });
  });
});

describe("sanitizePlanForCommand", () => {
  it("keeps only items with an id, a title and a type", () => {
    const plan = sanitizePlanForCommand({
      items: [{ id: "s1", title: "Work on: Lab", type: "study_block" }, null, { id: "x" }],
      suggestions: "nope",
    });
    expect(plan.items.map((i) => i.id)).toEqual(["s1"]);
    expect(plan.suggestions).toEqual([]);
    expect(sanitizePlanForCommand(null)).toEqual({ items: [], suggestions: [] });
  });
});
