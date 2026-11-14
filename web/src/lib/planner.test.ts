import { describe, expect, it } from "vitest";
import {
  type Building,
  addDays,
  addLeaveTimes,
  atTime,
  classItems,
  clock,
  findBuilding,
  fittingEvents,
  freeGaps,
  hasPhrase,
  isOnline,
  mstDate,
  placeStudyBlocks,
  rankByOverlap,
  reserveTime,
  templateBriefing,
  toMstIso,
  walkMinutes,
  weekdayOf,
} from "./planner";
import type { DayItem } from "./types";

const MIN = 60_000;
const BUILDINGS: Building[] = [
  { id: "BYENG", name: "Brickyard Engineering", lat: 33.4235, lng: -111.9397 },
  { id: "COOR", name: "Lattie F. Coor Hall", lat: 33.4209, lng: -111.937 },
  { id: "MU", name: "Memorial Union", lat: 33.4174, lng: -111.9345 },
  { id: "MANZ", name: "Manzanita Hall", lat: 33.4171, lng: -111.9395, aliases: ["Manzanita"] },
];
const ms = (iso: string) => new Date(iso).getTime();
const item = (over: Partial<DayItem>): DayItem => ({ id: "x", type: "event", title: "X", start: "2026-11-16T10:00:00-07:00", source: "planner", ...over });

describe("Arizona time helpers", () => {
  it("formats in MST without daylight saving", () => {
    expect(toMstIso(new Date("2026-07-01T20:30:00Z"))).toBe("2026-07-01T13:30:00-07:00");
    expect(toMstIso(new Date("2026-12-01T20:30:00Z"))).toBe("2026-12-01T13:30:00-07:00");
  });

  it("uses the Arizona calendar day, not UTC", () => {
    // 23:30 in Tempe is already the next day in UTC.
    expect(mstDate(new Date("2026-11-17T06:30:00Z"))).toBe("2026-11-16");
  });

  it("builds local times, weekdays and day offsets", () => {
    expect(toMstIso(atTime("2026-11-16", "9:05"))).toBe("2026-11-16T09:05:00-07:00");
    expect(weekdayOf("2026-11-16")).toBe("Mon");
    expect(weekdayOf("2026-11-15")).toBe("Sun");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(clock("2026-11-16T13:12:00-07:00")).toBe("1:12 PM");
  });
});

describe("buildings", () => {
  it("matches ids, names and aliases as whole words", () => {
    expect(findBuilding(BUILDINGS, "BYENG 210")?.id).toBe("BYENG");
    expect(findBuilding(BUILDINGS, "Memorial Union 202")?.id).toBe("MU");
    expect(findBuilding(BUILDINGS, "manzanita")?.id).toBe("MANZ");
    expect(findBuilding(BUILDINGS, "MU")?.id).toBe("MU");
  });

  it("does not match parts of words or online places", () => {
    expect(findBuilding(BUILDINGS, "Music Building")).toBeUndefined();
    expect(findBuilding(BUILDINGS, "Community room")).toBeUndefined();
    expect(findBuilding(BUILDINGS, "Online (Zoom)")).toBeUndefined();
    expect(findBuilding(BUILDINGS, "")).toBeUndefined();
  });

  it("detects online locations", () => {
    expect(isOnline("Online")).toBe(true);
    expect(isOnline("Zoom meeting")).toBe(true);
    expect(isOnline("Memorial Union")).toBe(false);
  });

  it("estimates walks, longer on hot days and a default when a building is unknown", () => {
    const byeng = BUILDINGS[0];
    const manz = BUILDINGS[3];
    const normal = walkMinutes(manz, byeng, false);
    expect(normal).toBeGreaterThanOrEqual(10);
    expect(normal).toBeLessThanOrEqual(20);
    expect(walkMinutes(manz, byeng, true)).toBe(normal + 2);
    expect(walkMinutes(byeng, byeng, false)).toBe(3);
    expect(walkMinutes(undefined, byeng, false)).toBe(10);
  });

  it("hasPhrase needs whole words", () => {
    expect(hasPhrase("robotics | engineering", "robotics")).toBe(true);
    expect(hasPhrase("startup pitch", "art")).toBe(false);
  });
});

describe("timeline", () => {
  it("keeps only today's classes and links their buildings", () => {
    const items = classItems(
      [
        { course: "CSE 230", days: ["Mon", "Wed"], start: "10:30", end: "11:20", location: "BYENG 210" },
        { course: "ENG 102", days: ["Tue"], start: "09:00", end: "10:15" },
      ],
      "2026-11-16",
      BUILDINGS,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "CSE 230", type: "class", buildingId: "BYENG", start: "2026-11-16T10:30:00-07:00" });
  });

  it("finds free gaps around busy items, starting at leaveAt when known", () => {
    const busy = [item({ start: "2026-11-16T10:00:00-07:00", end: "2026-11-16T11:00:00-07:00", leaveAt: "2026-11-16T09:45:00-07:00" })];
    const gaps = freeGaps(ms("2026-11-16T08:00:00-07:00"), ms("2026-11-16T12:00:00-07:00"), busy, 10);
    expect(gaps.map((g) => [toMstIso(new Date(g.start)), toMstIso(new Date(g.end))])).toEqual([
      ["2026-11-16T08:00:00-07:00", "2026-11-16T09:45:00-07:00"],
      ["2026-11-16T11:00:00-07:00", "2026-11-16T12:00:00-07:00"],
    ]);
  });

  it("reserveTime splits a gap around a window", () => {
    const gaps = [{ start: 0, end: 100 }];
    reserveTime(gaps, 40, 60);
    expect(gaps).toEqual([
      { start: 0, end: 40 },
      { start: 60, end: 100 },
    ]);
  });

  it("only suggests events that leave room to walk there", () => {
    const gaps = [{ start: ms("2026-11-16T11:20:00-07:00"), end: ms("2026-11-16T13:20:00-07:00") }];
    const tooTight = item({ id: "a", start: "2026-11-16T11:20:00-07:00", end: "2026-11-16T12:00:00-07:00", location: "MU" });
    const fine = item({ id: "b", start: "2026-11-16T11:40:00-07:00", end: "2026-11-16T12:30:00-07:00", location: "MU" });
    const online = item({ id: "c", start: "2026-11-16T11:20:00-07:00", end: "2026-11-16T12:00:00-07:00", location: "Online" });
    const tooLong = item({ id: "d", start: "2026-11-16T12:30:00-07:00", end: "2026-11-16T13:30:00-07:00" });
    const now = ms("2026-11-16T08:00:00-07:00");
    expect(fittingEvents([tooTight, fine, online, tooLong], gaps, now, 10).map((e) => e.id)).toEqual(["b", "c"]);
  });
});

describe("study blocks", () => {
  const now = ms("2026-11-16T08:00:00-07:00");
  const deadline = (id: string, due: string, done = false) => item({ id, type: "deadline", title: id, start: due, done, source: "canvas" });

  it("fills free time before each due time, earliest deadline first, skipping submitted work", () => {
    const gaps = [{ start: now, end: ms("2026-11-16T12:00:00-07:00") }];
    const blocks = placeStudyBlocks(
      [deadline("late", "2026-11-17T12:00:00-07:00"), deadline("soon", "2026-11-16T23:59:00-07:00"), deadline("done", "2026-11-16T20:00:00-07:00", true)],
      gaps,
      now,
      () => 60,
    );
    expect(blocks.map((b) => [b.title, b.start.slice(11, 16), b.end!.slice(11, 16)])).toEqual([
      ["Work on: soon", "08:00", "09:00"],
      ["Work on: late", "09:00", "10:00"],
    ]);
  });

  it("never makes a block shorter than 25 minutes or past the due time", () => {
    const gaps = [
      { start: now, end: ms("2026-11-16T08:50:00-07:00") },
      { start: ms("2026-11-16T10:00:00-07:00"), end: ms("2026-11-16T10:20:00-07:00") }, // too short
      { start: ms("2026-11-16T11:00:00-07:00"), end: ms("2026-11-16T14:00:00-07:00") },
    ];
    const blocks = placeStudyBlocks([deadline("a", "2026-11-16T11:30:00-07:00")], gaps, now, () => 60);
    for (const b of blocks) expect(ms(b.end!) - ms(b.start)).toBeGreaterThanOrEqual(25 * MIN);
    expect(blocks.map((b) => [b.start.slice(11, 16), b.end!.slice(11, 16)])).toEqual([
      ["08:00", "08:50"],
      ["11:00", "11:25"],
    ]);
  });

  it("falls back to 60 minutes when the estimate is not a number", () => {
    const gaps = [{ start: now, end: ms("2026-11-16T12:00:00-07:00") }];
    const [b] = placeStudyBlocks([deadline("a", "2026-11-16T23:00:00-07:00")], gaps, now, () => Number.NaN);
    expect(ms(b.end!) - ms(b.start)).toBe(60 * MIN);
  });

  it("ignores deadlines that already passed", () => {
    const gaps = [{ start: now, end: ms("2026-11-16T12:00:00-07:00") }];
    expect(placeStudyBlocks([deadline("old", "2026-11-16T07:00:00-07:00")], gaps, now, () => 60)).toEqual([]);
  });
});

describe("leave times", () => {
  it("walks from the previous stop, skips online items and adds time on hot days", () => {
    const items = [
      item({ id: "c1", type: "class", start: "2026-11-16T10:30:00-07:00", buildingId: "BYENG" }),
      item({ id: "e1", start: "2026-11-16T12:00:00-07:00", location: "Online" }),
      item({ id: "c2", type: "class", start: "2026-11-16T13:30:00-07:00", buildingId: "BYENG" }),
    ];
    addLeaveTimes(items, BUILDINGS, "Manzanita", { tempF: 99, highF: 104, isHot: true });
    const c1Walk = walkMinutes(BUILDINGS[3], BUILDINGS[0], true);
    expect(items[0].leaveAt).toBe(toMstIso(new Date(ms(items[0].start) - c1Walk * MIN)));
    expect(items[1].leaveAt).toBeUndefined();
    // Same building as the class before: 2 minutes of buffer plus 2 for the heat.
    expect(items[2].leaveAt).toBe("2026-11-16T13:26:00-07:00");
  });
});

describe("fallbacks without Gemini", () => {
  it("ranks events by whole-word interest matches", () => {
    const events = [
      item({ id: "a", title: "Startup pitch night", tags: ["business"] }),
      item({ id: "b", title: "Robotics build night", tags: ["robotics", "engineering"] }),
      item({ id: "c", title: "Art walk", tags: ["art"] }),
    ];
    const ranked = rankByOverlap(events, ["robotics", "engineering", "art"]);
    expect(ranked.map((r) => r.item.id)).toEqual(["b", "c"]);
    expect(ranked[0].why).toBe("Matches your interest in robotics and engineering.");
  });

  it("writes a briefing that mentions heat, first class and open work", () => {
    const text = templateBriefing(
      [
        item({ type: "class", title: "CSE 230", start: "2026-11-16T10:30:00-07:00", leaveAt: "2026-11-16T10:14:00-07:00" }),
        item({ type: "deadline", title: "Lab 7", start: "2026-11-16T23:59:00-07:00", done: false }),
      ],
      [item({ title: "Robotics build night", start: "2026-11-16T16:00:00-07:00" })],
      { tempF: 97, highF: 101, isHot: true },
    );
    expect(text).toContain("97 degrees");
    expect(text).toContain("stay in the shade");
    expect(text).toContain("leave by 10:14 AM");
    expect(text).toContain("Lab 7");
    expect(text).toContain("Robotics build night at 4:00 PM");
  });
});
