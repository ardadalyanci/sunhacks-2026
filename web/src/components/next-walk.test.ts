import { describe, expect, it } from "vitest";
import type { DayItem } from "@/lib/types";
import { findPlace, nextWalk, placeLabel, toCelsius, untilText, walkLink } from "./next-walk";

const at = (hhmm: string) => `2026-11-16T${hhmm}:00-07:00`;
const item = (id: string, type: DayItem["type"], start: string, leaveAt?: string, location?: string): DayItem => ({
  id,
  type,
  title: id,
  start: at(start),
  leaveAt: leaveAt ? at(leaveAt) : undefined,
  location,
  source: "planner",
});

describe("places", () => {
  it("finds buildings by code or name and keeps the room", () => {
    expect(findPlace("BYENG 210")).toMatchObject({ building: { id: "BYENG" }, room: "210" });
    expect(findPlace("Memorial Union 230")).toMatchObject({ building: { id: "MU" }, room: "230" });
    expect(findPlace("Hayden Library")).toMatchObject({ building: { id: "LIB" }, room: "" });
    expect(findPlace("Somewhere new").building).toBeUndefined();
  });

  it("uses the names students say", () => {
    expect(placeLabel("BYENG 210")).toBe("Brickyard 210");
    expect(placeLabel("COOR 170")).toBe("Coor Hall 170");
    expect(placeLabel("Memorial Union 230")).toBe("MU 230");
    expect(placeLabel("Hayden Library")).toBe("Hayden");
    expect(placeLabel("Somewhere new")).toBe("Somewhere new");
  });

  it("links walking directions to the building's coordinates", () => {
    expect(walkLink("BYENG 210")).toMatch(/destination=33\.\d+%2C-111\.\d+&travelmode=walking$/);
    expect(walkLink("Somewhere new")).toContain(encodeURIComponent("Somewhere new, Tempe, AZ"));
  });
});

describe("nextWalk", () => {
  const items = [
    item("study", "study_block", "08:00"),
    item("CSE 230", "class", "10:30", "10:13", "BYENG 210"),
    item("Robotics", "event", "16:15", "15:59", "Memorial Union 230"),
  ];

  it("skips study blocks and finds the next class or event with a leave time", () => {
    expect(nextWalk(items, Date.parse(at("08:00")))).toMatchObject({ item: { id: "CSE 230" }, minutes: 17, now: false });
  });

  it("says leave now between the leave time and the start, then moves on", () => {
    expect(nextWalk(items, Date.parse(at("10:20")))).toMatchObject({ item: { id: "CSE 230" }, now: true });
    expect(nextWalk(items, Date.parse(at("11:00")))?.item.id).toBe("Robotics");
    expect(nextWalk(items, Date.parse(at("17:00")))).toBeNull();
  });
});

describe("small formats", () => {
  it("reads durations and converts heat", () => {
    expect(untilText(133 * 60_000)).toBe("2 h 13 min");
    expect(untilText(23 * 60_000)).toBe("23 min");
    expect(untilText(60 * 60_000)).toBe("1 h");
    expect(toCelsius(104)).toBe(40);
  });
});
