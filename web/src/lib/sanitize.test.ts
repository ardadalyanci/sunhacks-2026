import { describe, expect, it } from "vitest";
import { isCalendarDate, sanitizeCommandRequest, sanitizePlanRequest, sanitizeSetup } from "./sanitize";

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

  it("derives isHot when it is missing", () => {
    const res = sanitizePlanRequest({ classes: [], weather: { tempF: 90, highF: 101 } });
    expect(res.ok && res.value.weather).toEqual({ tempF: 90, highF: 101, isHot: true });
  });
});

describe("sanitizeSetup", () => {
  it("keeps valid classes with building and room, uppercases building codes", () => {
    expect(
      sanitizeSetup({
        name: "Maya",
        interests: ["Robotics", 5, ""],
        classes: [
          { course: "CSE 230", days: ["Mon"], start: "09:00", end: "09:50", building: "byeng", room: "210" },
          { course: "Bad", days: ["Mon"], start: "9am", end: "10am", building: "COOR" },
        ],
      }),
    ).toEqual({ name: "Maya", interests: ["Robotics"], classes: [{ course: "CSE 230", days: ["Mon"], start: "09:00", end: "09:50", building: "BYENG", room: "210" }] });
  });

  it("returns null when nothing usable is there", () => {
    expect(sanitizeSetup(null)).toBeNull();
    expect(sanitizeSetup({ classes: "x" })).toBeNull();
  });
});

describe("sanitizeCommandRequest", () => {
  it("accepts transcript or text, keeps valid items and picks (CampusEvent or EventPick)", () => {
    const req = sanitizeCommandRequest({
      text: "add robotics",
      items: [{ id: "s1", kind: "study", title: "Work on Lab 7", startsAt: "2026-11-16T09:00:00-07:00" }, { id: "x", kind: "weird", title: "?" }, null],
      picks: [
        { id: "e1", title: "Robotics", startsAt: "2026-11-16T16:00:00-07:00", source: "sun_devil_central" },
        { event: { id: "e2", title: "Mixer", startsAt: "2026-11-16T17:00:00-07:00" }, score: 1, why: "" },
        { id: "e3", title: "No time" },
      ],
    });
    expect(req?.transcript).toBe("add robotics");
    expect(req?.items.map((i) => i.id)).toEqual(["s1"]);
    expect(req?.picks.map((p) => [p.id, p.source])).toEqual([
      ["e1", "sun_devil_central"],
      ["e2", "asu_events"],
    ]);
  });

  it("returns null without a transcript", () => {
    expect(sanitizeCommandRequest({ items: [] })).toBeNull();
    expect(sanitizeCommandRequest("hi")).toBeNull();
  });
});
