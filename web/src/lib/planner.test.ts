import { describe, expect, it } from "vitest";
import {
  type Building,
  addDays,
  addLeaveTimes,
  atTime,
  classItems,
  clock,
  eventTitle,
  findBuilding,
  fittingEvents,
  freeGaps,
  hasPhrase,
  isCourse,
  isOnline,
  mstDate,
  onCampusThen,
  placeStudyBlocks,
  rankByOverlap,
  reserveTime,
  templateBriefing,
  toMstIso,
  walkMinutes,
  weekdayOf,
} from "./planner";
import { commuteMinutes } from "./commute";
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

  it("names a club event with its club when the title alone says nothing", () => {
    const club = "Political Computer Science at ASU";
    expect(eventTitle({ title: "Weekly Meeting", organizer: club })).toBe(`${club}: Weekly Meeting`);
    expect(eventTitle({ title: "General Body Meeting", organizer: club })).toBe(`${club}: General Body Meeting`);
    expect(eventTitle({ title: "Weekly Meeting!", organizer: club })).toBe(`${club}: Weekly Meeting!`);
    expect(eventTitle({ title: "General Meeting", organizer: "" })).toBe("General Meeting");
    expect(eventTitle({ title: "Sun Devil Quizbowl Weekly Meeting", organizer: club })).toBe("Sun Devil Quizbowl Weekly Meeting");
  });

  it("trusts a building code in parentheses over a longer name", () => {
    const wings: Building[] = [
      { id: "LSA", name: "Life Sciences Center A Wing", lat: 33.42, lng: -111.93, aliases: ["Life Sciences Center"] },
      { id: "LSE", name: "Life Sciences E Wing", lat: 33.42, lng: -111.93 },
    ];
    expect(findBuilding(wings, "Life Sciences Center E (LSE), Room 104")?.id).toBe("LSE");
    expect(findBuilding(wings, "Life Sciences Center")?.id).toBe("LSA");
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

  it("gives a slower walker more time for the same walk, and more again on a hot day", () => {
    const byeng = BUILDINGS[0];
    const manz = BUILDINGS[3];
    const normal = walkMinutes(manz, byeng, false);
    const slower = walkMinutes(manz, byeng, false, true);
    const slowerHot = walkMinutes(manz, byeng, true, true);
    expect(slower).toBeGreaterThan(normal);
    expect(slowerHot).toBeGreaterThan(slower);
    expect(slowerHot - slower).toBeGreaterThanOrEqual(4); // a shade stop, not just 2 minutes
    expect(slowerHot).toBeGreaterThan(walkMinutes(manz, byeng, true));
    // An unknown building: 10 minutes at the usual pace, 35% more when slower, plus 5 in the heat.
    expect(walkMinutes(undefined, byeng, false, true)).toBe(14);
    expect(walkMinutes(undefined, byeng, true, true)).toBe(19);
    expect(walkMinutes(byeng, byeng, false, true)).toBe(3);
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

  const times = (blocks: DayItem[]) => blocks.map((b) => [b.start.slice(11, 16), b.end!.slice(11, 16)]);
  const total = (blocks: DayItem[]) => blocks.reduce((sum, b) => sum + ms(b.end!) - ms(b.start), 0) / MIN;

  it("never makes a block shorter than 25 minutes, past the due time or longer than the estimate", () => {
    const gaps = [
      { start: now, end: ms("2026-11-16T08:50:00-07:00") },
      { start: ms("2026-11-16T10:00:00-07:00"), end: ms("2026-11-16T10:20:00-07:00") }, // too short
      { start: ms("2026-11-16T11:00:00-07:00"), end: ms("2026-11-16T14:00:00-07:00") },
    ];
    const blocks = placeStudyBlocks([deadline("a", "2026-11-16T11:30:00-07:00")], gaps, now, () => 60);
    for (const b of blocks) expect(ms(b.end!) - ms(b.start)).toBeGreaterThanOrEqual(25 * MIN);
    // 50 free minutes then 30 before the due time: 35 + 25, so neither piece is a crumb and nothing is padded.
    expect(times(blocks)).toEqual([
      ["08:00", "08:35"],
      ["11:00", "11:25"],
    ]);
    expect(total(blocks)).toBe(60);
  });

  it("places exactly the estimate when it fits in one gap", () => {
    const gaps = [{ start: now, end: ms("2026-11-16T12:00:00-07:00") }];
    expect(times(placeStudyBlocks([deadline("a", "2026-11-16T23:00:00-07:00")], gaps, now, () => 45))).toEqual([["08:00", "08:45"]]);
  });

  it("fills a gap when a full block is still left for later", () => {
    const gaps = [
      { start: now, end: ms("2026-11-16T08:30:00-07:00") },
      { start: ms("2026-11-16T10:00:00-07:00"), end: ms("2026-11-16T12:00:00-07:00") },
    ];
    expect(times(placeStudyBlocks([deadline("a", "2026-11-16T23:00:00-07:00")], gaps, now, () => 90))).toEqual([
      ["08:00", "08:30"],
      ["10:00", "11:00"],
    ]);
  });

  it("skips a gap it can't split well and puts all of a short piece in a later gap", () => {
    // 45 minutes needed, 40 free first: 40 + 5 would leave a crumb, and 45 is too little to split.
    const gaps = [
      { start: now, end: ms("2026-11-16T08:40:00-07:00") },
      { start: ms("2026-11-16T13:00:00-07:00"), end: ms("2026-11-16T14:00:00-07:00") },
    ];
    expect(times(placeStudyBlocks([deadline("a", "2026-11-16T23:00:00-07:00")], gaps, now, () => 45))).toEqual([["13:00", "13:45"]]);
  });

  it("fills a single gap when no later gap could take a saved piece", () => {
    const one = (minutes: number) => [{ start: now, end: now + minutes * MIN }];
    expect(times(placeStudyBlocks([deadline("a", "2026-11-16T23:00:00-07:00")], one(50), now, () => 70))).toEqual([["08:00", "08:50"]]);
    expect(times(placeStudyBlocks([deadline("a", "2026-11-16T23:00:00-07:00")], one(75), now, () => 90))).toEqual([["08:00", "09:15"]]);
    // With a later gap the split still saves a full block for it: 40 + 30.
    const two = [
      { start: now, end: ms("2026-11-16T08:40:00-07:00") },
      { start: ms("2026-11-16T13:00:00-07:00"), end: ms("2026-11-16T13:40:00-07:00") },
    ];
    expect(times(placeStudyBlocks([deadline("a", "2026-11-16T23:00:00-07:00")], two, now, () => 70))).toEqual([
      ["08:00", "08:40"],
      ["13:00", "13:30"],
    ]);
  });

  it("places a shorter piece rather than padding when nothing later fits", () => {
    const gaps = [
      { start: now, end: ms("2026-11-16T08:40:00-07:00") },
      { start: ms("2026-11-16T09:00:00-07:00"), end: ms("2026-11-16T09:30:00-07:00") },
    ];
    // Due at 10: no gap holds 45 minutes, so the roomiest one gets what fits.
    expect(times(placeStudyBlocks([deadline("a", "2026-11-16T10:00:00-07:00")], gaps, now, () => 45))).toEqual([["08:00", "08:40"]]);
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
      item({ id: "e1", start: "2026-11-16T12:00:00-07:00", end: "2026-11-16T13:00:00-07:00", location: "Online" }),
      item({ id: "c2", type: "class", start: "2026-11-16T13:30:00-07:00", buildingId: "BYENG" }),
    ];
    addLeaveTimes(items, BUILDINGS, "Manzanita", { tempF: 99, highF: 104, isHot: true });
    const c1Walk = walkMinutes(BUILDINGS[3], BUILDINGS[0], true);
    expect(items[0].leaveAt).toBe(toMstIso(new Date(ms(items[0].start) - c1Walk * MIN)));
    expect(items[1].leaveAt).toBeUndefined();
    // Same building as the class before (the online event in between keeps the student where they are): no walk.
    expect(items[2].leaveAt).toBeUndefined();
  });

  it("plans no walk to another room in the same building", () => {
    const items = [
      item({ id: "talk", start: "2026-11-16T12:00:00-07:00", end: "2026-11-16T12:50:00-07:00", location: "Memorial Union 202" }),
      item({ id: "shift", type: "class", title: "Work shift", start: "2026-11-16T13:30:00-07:00", location: "Memorial Union" }),
      item({ id: "cse", type: "class", title: "CSE 230", start: "2026-11-16T15:00:00-07:00", buildingId: "BYENG" }),
    ];
    addLeaveTimes(items, BUILDINGS, "Manzanita");
    expect(items[0].leaveAt).toBeDefined();
    expect(items[1].leaveAt).toBeUndefined();
    expect(items[2].leaveAt).toBe(toMstIso(new Date(ms(items[2].start) - walkMinutes(BUILDINGS[2], BUILDINGS[0], false) * MIN)));
  });

  it("gives a leave time again after a long break in the same building", () => {
    const day = (second: string) => [
      item({ id: "a", type: "class", title: "CSE 230", start: "2026-11-16T09:00:00-07:00", end: "2026-11-16T09:50:00-07:00", location: "BYENG 210" }),
      item({ id: "b", type: "class", title: "CSE 240", start: `2026-11-16T${second}:00-07:00`, location: "BYENG 190" }),
    ];
    const longBreak = day("15:00");
    addLeaveTimes(longBreak, BUILDINGS, "Manzanita");
    expect(longBreak[0].leaveAt).toBeDefined();
    // Five hours later the student has likely left: the walk from a place we do not know.
    const defaultWalk = walkMinutes(undefined, BUILDINGS[0], false);
    expect(longBreak[1].leaveAt).toBe(toMstIso(new Date(ms("2026-11-16T15:00:00-07:00") - defaultWalk * MIN)));
    const shortBreak = day("10:45"); // 55 minutes after: still down the hall
    addLeaveTimes(shortBreak, BUILDINGS, "Manzanita");
    expect(shortBreak[1].leaveAt).toBeUndefined();
  });

  it("walks again after a stop in a place it does not know", () => {
    const items = [
      item({ id: "a", type: "class", title: "CSE 230", start: "2026-11-16T10:30:00-07:00", end: "2026-11-16T11:20:00-07:00", buildingId: "BYENG" }),
      item({ id: "b", type: "class", title: "PHY 121", start: "2026-11-16T12:15:00-07:00", end: "2026-11-16T13:05:00-07:00", location: "Somewhere new" }),
      item({ id: "c", type: "class", title: "CSE 240", start: "2026-11-16T15:00:00-07:00", buildingId: "BYENG" }),
    ];
    addLeaveTimes(items, BUILDINGS, "Manzanita");
    expect(items[2].leaveAt).toBeDefined();
  });

  it("keeps an honest leave time and says so when the walk starts before the stop before ends", () => {
    const tight = () => [
      item({ id: "a", type: "class", title: "CSE 230", start: "2026-11-16T09:00:00-07:00", end: "2026-11-16T10:15:00-07:00", buildingId: "MANZ" }),
      item({ id: "b", type: "class", title: "MAT 343", start: "2026-11-16T10:20:00-07:00", end: "2026-11-16T11:35:00-07:00", buildingId: "BYENG" }),
      item({ id: "c", type: "class", title: "Work shift", start: "2026-11-16T12:30:00-07:00", end: "2026-11-16T13:00:00-07:00", buildingId: "MU" }),
    ];
    const slow = tight();
    addLeaveTimes(slow, BUILDINGS, "Manzanita", { tempF: 99, highF: 104, isHot: true }, true);
    const walk = walkMinutes(BUILDINGS[3], BUILDINGS[0], true, true);
    expect(slow[1].leaveAt).toBe(toMstIso(new Date(ms(slow[1].start) - walk * MIN)));
    expect(slow[1].why).toBe(`Tight: that is ${walk - 5} minutes before CSE 230 ends.`);
    expect(slow[2].why).toBeUndefined(); // plenty of time after MAT 343
    // A later plan with an easy walk drops the old warning.
    slow[1].start = "2026-11-16T11:00:00-07:00";
    slow[1].end = "2026-11-16T11:30:00-07:00";
    addLeaveTimes(slow, BUILDINGS, "Manzanita");
    expect(slow[1].why).toBeUndefined();
  });

  it("names a commitment as the student's own when the walk is tight", () => {
    const items = [
      item({ id: "a", type: "class", title: "Work shift", start: "2026-11-16T09:00:00-07:00", end: "2026-11-16T10:28:00-07:00", buildingId: "MANZ" }),
      item({ id: "b", type: "class", title: "CSE 230", start: "2026-11-16T10:30:00-07:00", buildingId: "BYENG" }),
    ];
    addLeaveTimes(items, BUILDINGS, "Manzanita");
    expect(items[1].why).toMatch(/^Tight: that is \d+ minutes before your work shift ends\.$/);
  });

  it("leaves earlier for every stop at a slower pace", () => {
    const stops = () => [
      item({ id: "c1", type: "class", start: "2026-11-16T10:30:00-07:00", buildingId: "BYENG" }),
      item({ id: "c2", type: "class", start: "2026-11-16T13:30:00-07:00", buildingId: "COOR" }),
    ];
    const usual = stops();
    const slower = stops();
    addLeaveTimes(usual, BUILDINGS, "Manzanita", { tempF: 99, highF: 104, isHot: true });
    addLeaveTimes(slower, BUILDINGS, "Manzanita", { tempF: 99, highF: 104, isHot: true }, true);
    for (let i = 0; i < usual.length; i++) expect(ms(slower[i].leaveAt!)).toBeLessThan(ms(usual[i].leaveAt!));
    expect(slower[0].leaveAt).toBe(toMstIso(new Date(ms(slower[0].start) - walkMinutes(BUILDINGS[3], BUILDINGS[0], true, true) * MIN)));
  });
});

describe("other campuses", () => {
  const POLY: Building[] = [
    { id: "polytechnic-administration-building", name: "Administration Building", lat: 33.30714, lng: -111.67937, campus: "polytechnic" },
    { id: "polytechnic-santan-hall", name: "Santan Hall", lat: 33.30612, lng: -111.67812, campus: "polytechnic" },
    { id: "polytechnic-peralta-hall", name: "Peralta Hall", lat: 33.30612, lng: -111.67913, campus: "polytechnic" },
  ];
  const ALL = [...BUILDINGS, ...POLY];

  it("looks a building up on one campus only, Tempe by default", () => {
    expect(findBuilding(ALL, "Administration Building 101")).toBeUndefined(); // a Tempe class never lands at Poly
    expect(findBuilding(ALL, "Administration Building 101", "polytechnic")?.id).toBe("polytechnic-administration-building");
    expect(findBuilding(ALL, "BYENG 210")?.id).toBe("BYENG");
    expect(findBuilding(ALL, "BYENG 210", "polytechnic")).toBeUndefined();
  });

  it("takes the shuttle between campuses: walk to the stop, be there in time, walk from the stop", () => {
    const stops = [
      item({ id: "c1", type: "class", start: "2026-11-16T09:00:00-07:00", end: "2026-11-16T09:50:00-07:00", buildingId: "BYENG" }),
      item({ id: "c2", type: "class", start: "2026-11-16T11:30:00-07:00", end: "2026-11-16T12:20:00-07:00", location: "Santan Hall 120", campus: "polytechnic" }),
      item({ id: "c3", type: "class", start: "2026-11-16T13:30:00-07:00", location: "Peralta Hall 101", campus: "polytechnic" }),
    ];
    const asked: string[] = [];
    const shuttle = (from: string, to: string, arriveBy: string) => {
      asked.push(`${from}>${to} by ${arriveBy}`);
      return { beAtStopBy: "2026-11-16T10:15:00-07:00", via: "Gold shuttle from Forest Avenue and Lemon Street to SIM Building" };
    };
    addLeaveTimes(stops, ALL, "Manzanita", undefined, false, { shuttle });
    expect(asked).toEqual(["tempe>polytechnic by 2026-11-16T11:20:00-07:00"]); // 10-minute walk from the stop
    expect(stops[1].leaveAt).toBe("2026-11-16T10:05:00-07:00"); // 10-minute walk to the stop
    expect(stops[1].via).toBe("Gold shuttle from Forest Avenue and Lemon Street to SIM Building");
    // The next stop is a walk on Poly, from Santan Hall to Peralta Hall.
    expect(stops[2].via).toBeUndefined();
    expect(stops[2].leaveAt).toBe(toMstIso(new Date(ms(stops[2].start) - walkMinutes(POLY[1], POLY[2], false) * MIN)));
  });

  it("starts the day on the home campus, and says so when no shuttle fits", () => {
    const stops = [item({ id: "c1", type: "class", start: "2026-11-15T08:30:00-07:00", location: "Santan Hall 120", campus: "polytechnic" })];
    addLeaveTimes(stops, ALL, undefined, undefined, false, { home: "polytechnic", shuttle: () => undefined });
    expect(stops[0].via).toBeUndefined(); // already on Poly: a walk, no shuttle
    const away = [item({ id: "c1", type: "class", start: "2026-11-15T08:30:00-07:00", location: "Santan Hall 120", campus: "polytechnic" })];
    addLeaveTimes(away, ALL, "Manzanita", undefined, false, { shuttle: () => ({ via: "Polytechnic-Tempe (Gold): no shuttle in time." }) });
    expect(away[0].leaveAt).toBeUndefined();
    expect(away[0].via).toBe("Polytechnic-Tempe (Gold): no shuttle in time.");
  });

  it("says so when the shuttle leaves before the class before it ends", () => {
    const stops = [
      item({ id: "c1", type: "class", title: "CSE 240", start: "2026-11-16T15:00:00-07:00", end: "2026-11-16T15:50:00-07:00", buildingId: "BYENG" }),
      item({ id: "c2", type: "class", start: "2026-11-16T16:30:00-07:00", location: "Santan Hall 120", campus: "polytechnic" }),
    ];
    addLeaveTimes(stops, ALL, "Manzanita", undefined, false, { shuttle: () => ({ beAtStopBy: "2026-11-16T15:15:00-07:00", via: "Gold shuttle" }) });
    expect(stops[1].leaveAt).toBe("2026-11-16T15:05:00-07:00");
    expect(stops[1].why).toBe("Tight: that is 45 minutes before CSE 240 ends.");
  });

  it("starts an off-campus day with the student's own commute, then walks as usual", () => {
    const stops = [
      item({ id: "o", type: "class", start: "2026-11-16T08:00:00-07:00", end: "2026-11-16T08:50:00-07:00", location: "Online" }),
      item({ id: "c1", type: "class", start: "2026-11-16T10:30:00-07:00", end: "2026-11-16T11:20:00-07:00", buildingId: "BYENG" }),
      item({ id: "c2", type: "class", start: "2026-11-16T12:00:00-07:00", buildingId: "COOR" }),
    ];
    addLeaveTimes(stops, ALL, "Manzanita", { tempF: 99, highF: 101, isHot: true }, true, { commute: { minutes: 25, by: "drive" } });
    expect(stops[0].leaveAt).toBeUndefined(); // online: the commute waits for the first place to go to
    expect(stops[1].leaveAt).toBe("2026-11-16T10:05:00-07:00"); // 25 minutes, no heat or pace minutes on top of the student's own estimate
    expect(stops[1].via).toBe("From home by car: about 25 minutes, your own estimate.");
    expect(stops[2].via).toBeUndefined(); // the next stop is a walk from Brickyard, not from the start building
    expect(stops[2].leaveAt).toBe(toMstIso(new Date(ms(stops[2].start) - walkMinutes(BUILDINGS[0], BUILDINGS[1], true, true) * MIN)));
  });

  it("rides home to the home campus first when the first stop is on another campus", () => {
    const stops = [item({ id: "c1", type: "class", start: "2026-11-16T11:30:00-07:00", location: "Santan Hall 120", campus: "polytechnic" })];
    const shuttle = () => ({ beAtStopBy: "2026-11-16T10:15:00-07:00", via: "Gold shuttle from Forest Avenue and Lemon Street to SIM Building." });
    addLeaveTimes(stops, ALL, undefined, undefined, false, { commute: { minutes: 20, by: "bike" }, shuttle });
    expect(stops[0].leaveAt).toBe("2026-11-16T09:55:00-07:00");
    expect(stops[0].via).toBe(
      "From home by bike to the Tempe campus: about 20 minutes, your own estimate. Then: Gold shuttle from Forest Avenue and Lemon Street to SIM Building.",
    );
  });

  it("flags a commute that starts before the class before it ends", () => {
    const stops = [
      item({ id: "o", type: "class", title: "MAT 343", start: "2026-11-16T09:00:00-07:00", end: "2026-11-16T09:50:00-07:00", location: "Zoom" }),
      item({ id: "c1", type: "class", start: "2026-11-16T10:00:00-07:00", buildingId: "BYENG" }),
    ];
    addLeaveTimes(stops, ALL, undefined, undefined, false, { commute: { minutes: 30, by: "bus" } });
    expect(stops[1].leaveAt).toBe("2026-11-16T09:30:00-07:00");
    expect(stops[1].why).toBe("Tight: that is 20 minutes before MAT 343 ends.");
  });

  it("goes straight from a home point to the first stop, on any campus, and says how far", () => {
    const home = { lat: 33.4316, lng: -111.9452 }; // by Tempe Town Lake
    const stops = [item({ id: "c1", type: "class", start: "2026-11-16T10:30:00-07:00", end: "2026-11-16T11:20:00-07:00", buildingId: "BYENG" })];
    addLeaveTimes(stops, ALL, undefined, undefined, false, { commute: { by: "bike", home } });
    const minutes = commuteMinutes(home, BUILDINGS[0], "bike");
    expect(stops[0].leaveAt).toBe(toMstIso(new Date(ms(stops[0].start) - minutes * MIN)));
    expect(stops[0].via).toBe(`From home by bike: about 0.8 miles, ${minutes} minutes.`);
    // A home in Mesa driving to Poly goes straight there, not through Tempe and the shuttle.
    const mesa = { lat: 33.39, lng: -111.75 };
    const poly = [item({ id: "p", type: "class", start: "2026-11-16T11:30:00-07:00", location: "Santan Hall 120", campus: "polytechnic" })];
    addLeaveTimes(poly, ALL, undefined, undefined, false, { home: "tempe", commute: { by: "drive", home: mesa }, shuttle: () => undefined });
    expect(poly[0].via).toMatch(/^From home by car: about [\d.]+ miles, \d+ minutes\.$/);
    expect(poly[0].leaveAt).toBe(toMstIso(new Date(ms(poly[0].start) - commuteMinutes(mesa, POLY[1], "drive") * MIN)));
  });

  it("takes the shuttle from the campus nearest home when going straight would take over two hours", () => {
    const home = { lat: 33.4316, lng: -111.9452 }; // Tempe, walking to Poly: far over two hours
    const stops = [item({ id: "p", type: "class", start: "2026-11-16T11:30:00-07:00", location: "Santan Hall 120", campus: "polytechnic" })];
    const shuttle = () => ({ beAtStopBy: "2026-11-16T10:15:00-07:00", via: "Gold shuttle." });
    addLeaveTimes(stops, ALL, undefined, undefined, false, { commute: { by: "walk", home }, shuttle });
    const toTempe = commuteMinutes(home, { lat: 33.42, lng: -111.93 }, "walk");
    expect(stops[0].leaveAt).toBe(toMstIso(new Date(ms("2026-11-16T10:15:00-07:00") - toTempe * MIN)));
    expect(stops[0].via).toMatch(/^From home on foot to the Tempe campus: about [\d.]+ miles, \d+ minutes\. Then: Gold shuttle\.$/);
  });

  it("keeps the student's own minutes over the map estimate", () => {
    const stops = [item({ id: "c1", type: "class", start: "2026-11-16T10:30:00-07:00", buildingId: "BYENG" })];
    addLeaveTimes(stops, ALL, undefined, undefined, false, { commute: { by: "drive", minutes: 40, home: { lat: 33.4316, lng: -111.9452 } } });
    expect(stops[0].leaveAt).toBe("2026-11-16T09:50:00-07:00");
    expect(stops[0].via).toBe("From home by car: about 40 minutes, your own estimate.");
  });

  it("picks only events on the campus the student is on at the time, and online ones", () => {
    const stops = [
      item({ id: "c1", type: "class", start: "2026-11-16T09:00:00-07:00", end: "2026-11-16T09:50:00-07:00", buildingId: "BYENG" }),
      item({ id: "z", type: "class", start: "2026-11-16T12:00:00-07:00", location: "Zoom" }),
      item({ id: "c2", type: "class", start: "2026-11-16T13:00:00-07:00", end: "2026-11-16T13:50:00-07:00", location: "Santan Hall 120", campus: "polytechnic" }),
    ];
    const events = [
      item({ id: "early-poly", start: "2026-11-16T08:00:00-07:00", campus: "polytechnic" }),
      item({ id: "tempe-noon", start: "2026-11-16T12:30:00-07:00" }),
      item({ id: "poly-noon", start: "2026-11-16T12:30:00-07:00", campus: "polytechnic" }),
      item({ id: "poly-late", start: "2026-11-16T15:00:00-07:00", campus: "polytechnic" }),
      item({ id: "tempe-late", start: "2026-11-16T15:00:00-07:00" }),
      item({ id: "online", start: "2026-11-16T15:00:00-07:00", location: "Online", campus: "polytechnic" }),
    ];
    expect(onCampusThen(events, stops).map((e) => e.id)).toEqual(["tempe-noon", "poly-late", "online"]);
    expect(onCampusThen(events.slice(0, 1), [], "polytechnic").map((e) => e.id)).toEqual(["early-poly"]);
  });

  it("puts a class's campus on its timeline item", () => {
    const [poly] = classItems([{ course: "EGR 104", days: ["Mon"], start: "11:30", end: "12:20", location: "Santan Hall 120", campus: "polytechnic" }], "2026-11-16", ALL);
    expect(poly).toMatchObject({ campus: "polytechnic", buildingId: "polytechnic-santan-hall" });
    const [tempe] = classItems([{ course: "CSE 230", days: ["Mon"], start: "10:30", end: "11:20", location: "BYENG 210" }], "2026-11-16", ALL);
    expect(tempe).not.toHaveProperty("campus");
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
    expect(ranked[0].why).toBe("You picked robotics and engineering.");
    expect(ranked[1].why).toBe("You picked art.");
  });

  it("tells a course from a commitment by the exact course code", () => {
    expect(isCourse("CSE 230")).toBe(true);
    expect(isCourse("BIO 181L")).toBe(true);
    expect(isCourse("MAT 343 study group")).toBe(false);
    expect(isCourse("Work shift")).toBe(false);
  });

  it("writes a briefing in Sol's voice: heat, the first walk, open work and one pick", () => {
    const text = templateBriefing(
      [
        item({ type: "class", title: "CSE 230", start: "2026-11-16T10:30:00-07:00", leaveAt: "2026-11-16T10:14:00-07:00", location: "BYENG 210" }),
        item({ type: "deadline", title: "Lab 7", start: "2026-11-16T23:59:00-07:00", done: false }),
      ],
      [item({ title: "Robotics build night", start: "2026-11-16T16:00:00-07:00" })],
      { tempF: 97, highF: 101, isHot: true },
    );
    expect(text).toBe(
      "It's 97°F in Tempe now, with a high of 101°F, so fill your bottle before you go. Leave at 10:14 AM for CSE 230 in Brickyard 210. Lab 7 is due at 11:59 PM. I'd check out Robotics build night at 4:00 PM.",
    );
  });

  it("looks ahead at a later day the way Sol says it", () => {
    const text = templateBriefing(
      [
        item({ type: "class", title: "CSE 230", start: "2026-11-16T10:30:00-07:00", leaveAt: "2026-11-16T10:13:00-07:00", location: "BYENG 210" }),
        item({ type: "class", title: "PHY 121", start: "2026-11-16T12:15:00-07:00", location: "PSF 166" }),
        item({ type: "class", title: "CSE 240", start: "2026-11-16T15:00:00-07:00", location: "BYENG 190" }),
        item({ type: "deadline", title: "ENG 102: Reading response", start: "2026-11-16T11:00:00-07:00", done: false }),
      ],
      [item({ title: "Robotics club build night", start: "2026-11-16T16:15:00-07:00" })],
      { tempF: 70, highF: 84, isHot: false },
      "Tomorrow, Mon Nov 16",
      ms("2026-11-16T00:00:00-07:00"),
    );
    expect(text).toBe(
      "Tomorrow, Mon Nov 16, high of 84°F. Leave at 10:13 AM for CSE 230 in Brickyard 210, the first of your 3 classes. The Reading response for ENG 102 is due at 11:00 AM. I'd check out Robotics club build night at 4:15 PM.",
    );
  });

  it("names a shift as the student's own, and counts several open assignments", () => {
    const text = templateBriefing(
      [
        item({ type: "class", title: "Work shift", start: "2026-11-15T10:00:00-07:00", leaveAt: "2026-11-15T09:47:00-07:00", location: "Memorial Union" }),
        item({ type: "class", title: "CSE 230 study group", start: "2026-11-15T15:00:00-07:00" }),
        item({ type: "deadline", title: "CSE 230: Lab 7 (pipelining)", start: "2026-11-15T23:59:00-07:00", done: false }),
        item({ type: "deadline", title: "ENG 102: Reading response", start: "2026-11-15T21:00:00-07:00", done: false }),
        item({ type: "deadline", title: "MAT 343: Homework 9", start: "2026-11-15T17:00:00-07:00", done: true }),
      ],
      [],
    );
    expect(text).toBe(
      "Leave at 9:47 AM for your work shift at the MU, the first of 2 things today. 2 things are still open; the Reading response for ENG 102 is due first, at 9:00 PM.",
    );
  });

  it("only counts what is still ahead when it knows the time", () => {
    const day = [
      item({ type: "class", title: "CSE 230", start: "2026-11-16T10:30:00-07:00", leaveAt: "2026-11-16T10:13:00-07:00", location: "BYENG 210" }),
      item({ type: "class", title: "CSE 240", start: "2026-11-16T15:00:00-07:00", leaveAt: "2026-11-16T14:50:00-07:00", location: "BYENG 190" }),
      item({ type: "deadline", title: "CSE 230: Lab 7", start: "2026-11-16T09:00:00-07:00", done: false }), // overdue
      item({ type: "deadline", title: "CSE 240: Quiz 5", start: "2026-11-16T23:59:00-07:00", done: false }),
    ];
    expect(templateBriefing(day, [], undefined, undefined, ms("2026-11-16T14:00:00-07:00"))).toBe(
      "Leave at 2:50 PM for CSE 240 in Brickyard 190, the last of your 2 classes. Quiz 5 for CSE 240 is due at 11:59 PM.",
    );
    // Between the leave time and the start: "Leave now", never a time that has passed.
    expect(templateBriefing(day, [], undefined, undefined, ms("2026-11-16T14:55:00-07:00"))).toMatch(/^Leave now for CSE 240 in Brickyard 190,/);
    expect(templateBriefing(day, [], undefined, undefined, ms("2026-11-16T16:00:00-07:00"))).toBe(
      "Your classes are done for today. Quiz 5 for CSE 240 is due at 11:59 PM.",
    );
  });
});
