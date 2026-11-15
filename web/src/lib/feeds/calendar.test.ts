import { describe, expect, it } from "vitest";
import { buildDayIcs } from "./calendar";
import { parseIcs, unfold } from "./ical";
import type { DayPlan } from "../types";

const plan: DayPlan = {
  date: "2026-11-16",
  briefing: "",
  aiUsed: false,
  suggestions: [],
  weather: { tempF: 101, highF: 104, isHot: true },
  items: [
    { id: "class-1", type: "class", title: "MAT 343", start: "2026-11-16T13:30:00-07:00", end: "2026-11-16T14:45:00-07:00", buildingId: "COOR", location: "COOR 170", source: "manual", leaveAt: "2026-11-16T13:22:00-07:00" },
    { id: "study-1", type: "study_block", title: "Work on: CSE 230: Lab 7", start: "2026-11-16T15:00:00-07:00", end: "2026-11-16T16:00:00-07:00", source: "planner" },
    { id: "ev-robotics", type: "event", title: "Robotics build night", start: "2026-11-16T16:15:00-07:00", end: "2026-11-16T17:30:00-07:00", location: "Memorial Union 230", source: "sundevilcentral", why: "You picked robotics.", url: "https://sundevilcentral.eoss.asu.edu/rsvp?id=1" },
    { id: "d-1", type: "deadline", title: "CSE 230: Lab 7, part 2", start: "2026-11-16T23:59:00-07:00", source: "canvas", done: false, url: "https://canvas.asu.edu/a/1" },
    { id: "d-2", type: "deadline", title: "MAT 343: Homework 9", start: "2026-11-16T17:00:00-07:00", source: "canvas", done: true },
  ],
};

describe("buildDayIcs", () => {
  const ics = buildDayIcs(plan, { now: new Date("2026-11-16T15:00:00Z"), calendarName: "Sundial: Alex" });
  const events = parseIcs(ics);

  it("is valid iCalendar with CRLF lines of 75 octets or less", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(unfold(ics)).toContain("X-WR-CALNAME:Sundial: Alex");
  });

  it("has the class, study block, event and open deadline, but not submitted work", () => {
    expect(events.map((e) => e.summary)).toEqual(["MAT 343", "Work on: CSE 230: Lab 7", "Robotics build night", "Due: CSE 230: Lab 7, part 2"]);
    const [cls, , ev, due] = events;
    expect(cls.location).toBe("COOR 170");
    expect(cls.start?.toISOString()).toBe("2026-11-16T20:30:00.000Z");
    expect(cls.description).toContain("Leave at 1:22 PM (8 min walk).");
    expect(cls.description).toContain("Hot day (high 104°F)");
    expect(ev.description).toContain("You picked robotics.");
    expect(due.start?.toISOString()).toBe("2026-11-17T06:44:00.000Z");
    expect(due.end?.toISOString()).toBe("2026-11-17T06:59:00.000Z");
  });

  it("puts a reminder at the leave time", () => {
    const lines = unfold(ics);
    const cls = lines.slice(lines.indexOf("SUMMARY:MAT 343"));
    expect(cls).toContain("TRIGGER;VALUE=DATE-TIME:20261116T202200Z");
    expect(cls).toContain("DESCRIPTION:Leave now for COOR 170");
  });

  it("escapes commas in text", () => {
    expect(unfold(ics)).toContain("SUMMARY:Due: CSE 230: Lab 7\\, part 2");
  });
});
