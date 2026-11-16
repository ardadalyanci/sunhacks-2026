import { describe, expect, it } from "vitest";
import type { DayItem } from "@/lib/types";
import { dayRows } from "./day-rows";

const DATE = "2026-11-16";
const at = (hhmm: string, date = DATE) => `${date}T${hhmm}:00-07:00`;
const ms = (hhmm: string) => Date.parse(at(hhmm));

// A Monday: study for Lab 7 until the walk to Brickyard, CSE 230, a shift at the MU, an event from Sol's picks,
// HW 9 already turned in and Lab 7 still due tonight. Given out of order, as a plan might after edits.
const DAY: DayItem[] = [
  { id: "lab7", type: "deadline", title: "CSE 230: Lab 7 (pipelining)", start: at("23:59"), source: "canvas" },
  {
    id: "cse230",
    type: "class",
    title: "CSE 230",
    start: at("10:30"),
    end: at("11:20"),
    location: "BYENG 210",
    leaveAt: at("10:13"),
    source: "manual",
  },
  { id: "study", type: "study_block", title: "Work on: CSE 230: Lab 7 (pipelining)", start: at("08:00"), end: at("10:13"), source: "planner" },
  { id: "hw9", type: "deadline", title: "MAT 343: Homework 9", start: at("17:00"), done: true, source: "canvas" },
  { id: "shift", type: "class", title: "Work shift", start: at("12:00"), end: at("14:00"), location: "MU", leaveAt: at("11:47"), source: "manual" },
  {
    id: "robots",
    type: "event",
    title: "Robotics club build night",
    start: at("18:00"),
    end: at("19:30"),
    location: "COOR 170",
    leaveAt: at("17:45"),
    source: "sundevilcentral",
  },
];

describe("dayRows", () => {
  it("puts every row of the day in time order, in the sky's words", () => {
    const rows = dayRows(DAY, DATE, ms("08:00"));
    expect(rows.map((r) => [r.kind, r.time, r.title, r.detail])).toEqual([
      ["study", "8–10:13 am", "Work on Lab 7", "CSE 230"],
      ["leave", "10:13 am", "Leave for Brickyard 210", "17-minute walk"],
      ["block", "10:30–11:20 am", "CSE 230", "Brickyard 210"],
      ["leave", "11:47 am", "Leave for the MU", "13-minute walk"],
      ["block", "noon–2 pm", "Work shift", "the MU"],
      ["deadline", "5 pm", "HW 9", "turned in"],
      ["leave", "5:45 pm", "Leave for Coor Hall 170", "15-minute walk"],
      ["block", "6–7:30 pm", "Robotics club build night", "Coor Hall 170"],
      ["deadline", "11:59 pm", "Lab 7 due", "not turned in yet"],
    ]);
  });

  it("labels events and marks turned-in work", () => {
    const rows = dayRows(DAY, DATE, ms("08:00"));
    expect(rows.find((r) => r.itemId === "robots" && r.kind === "block")?.label).toBe("Event");
    expect(rows.find((r) => r.itemId === "shift" && r.kind === "block")?.label).toBeUndefined();
    expect(rows.find((r) => r.itemId === "hw9")?.done).toBe(true);
    expect(rows.find((r) => r.itemId === "lab7")?.done).toBe(false);
  });

  it("puts a leave row before its class when they share a time", () => {
    const tie: DayItem[] = [
      { id: "c", type: "class", title: "PHY 121", start: at("12:15"), end: at("13:05"), leaveAt: at("12:00"), location: "PSF 166", source: "manual" },
      { id: "e", type: "event", title: "Lunch talk", start: at("12:00"), end: at("12:10"), source: "asu_events" },
    ];
    expect(dayRows(tie, DATE, ms("08:00")).map((r) => r.key)).toEqual(["c-leave", "e", "c"]);
    const same: DayItem[] = [
      { id: "x", type: "class", title: "Lab", start: at("09:00"), end: at("10:00"), leaveAt: at("09:00"), source: "manual" },
    ];
    expect(dayRows(same, DATE, ms("08:00")).map((r) => r.kind)).toEqual(["leave", "block"]);
  });

  it("marks exactly one row next and dims rows that are over", () => {
    const rows = dayRows(DAY, DATE, ms("10:20"));
    expect(rows.filter((r) => r.next).map((r) => r.key)).toEqual(["cse230"]);
    expect(rows.filter((r) => r.past).map((r) => r.key)).toEqual(["study", "cse230-leave"]);
  });

  it("does not dim a class that is still going", () => {
    const rows = dayRows(DAY, DATE, ms("10:45"));
    const cse = rows.find((r) => r.key === "cse230");
    expect(cse?.past).toBeUndefined();
    expect(cse?.next).toBeUndefined();
    expect(rows.find((r) => r.next)?.key).toBe("shift-leave");
  });

  it("has no next row once the day is over, and none before the clock is known", () => {
    expect(dayRows(DAY, DATE, Date.parse(at("00:30", "2026-11-17"))).some((r) => r.next)).toBe(false);
    const unknown = dayRows(DAY, DATE, 0);
    expect(unknown.some((r) => r.next || r.past)).toBe(false);
    expect(dayRows(DAY, DATE, Number.NaN).some((r) => r.next || r.past)).toBe(false);
  });

  it("leaves out items on another date and keeps 11:59 pm last", () => {
    const withOthers: DayItem[] = [
      ...DAY,
      { id: "sun", type: "deadline", title: "ENG 102: Essay 3", start: at("23:59", "2026-11-15"), source: "canvas" },
      { id: "tue", type: "class", title: "ENG 102", start: at("09:00", "2026-11-17"), end: at("10:15", "2026-11-17"), source: "manual" },
    ];
    const rows = dayRows(withOthers, DATE, ms("08:00"));
    expect(rows.some((r) => r.itemId === "sun" || r.itemId === "tue")).toBe(false);
    expect(rows.at(-1)?.key).toBe("lab7");
  });

  it("says nothing for an empty day", () => {
    expect(dayRows([], DATE, ms("08:00"))).toEqual([]);
  });

  it("names the trip from home or the shuttle, and tells why a stop has no leave time", () => {
    const home: DayItem = { ...DAY[1], via: "From home by car: about 17 minutes, your own estimate." };
    const poly: DayItem = {
      id: "egr",
      type: "class",
      title: "EGR 104",
      start: at("16:30"),
      location: "Santan Hall 120",
      campus: "polytechnic",
      via: "No direct ASU shuttle in time.",
      source: "manual",
    };
    const rows = dayRows([home, poly], DATE, ms("08:00"));
    expect(rows.find((r) => r.key === "cse230-leave")?.detail).toBe("17-minute trip from home");
    expect(rows.find((r) => r.key === "egr")?.detail).toBe("Santan Hall 120 · No direct ASU shuttle in time.");
    expect(rows.some((r) => r.key === "egr-leave")).toBe(false);
  });
});
