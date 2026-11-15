import { afterEach, describe, expect, it, vi } from "vitest";
import type { DayPlan } from "./types";

// A fake database: what tests store, and what find() hands back.
const replaceOne = vi.fn();
const toArray = vi.fn();
const find = vi.fn(() => ({ sort: () => ({ limit: () => ({ toArray }) }) }));
const fakeDb = { collection: () => ({ replaceOne, find }) };
let db: typeof fakeDb | null = fakeDb;
vi.mock("./db", () => ({ getDb: async () => db, dbFailed: vi.fn() }));

const { savePlan, loadPlans, calendarIcs } = await import("./saved-plans");

const ID = "3f1c2b4a-8d9e-4f10-9a2b-1c3d4e5f6a7b";
const day = (date: string, title: string): DayPlan => ({
  date,
  items: [{ id: "class-0-CSE230", type: "class", title, start: `${date}T10:30:00-07:00`, end: `${date}T11:20:00-07:00`, source: "planner", location: "BYENG 210", leaveAt: `${date}T10:13:00-07:00` }],
  suggestions: [{ id: "ev-x", type: "event", title: "Not saved", start: `${date}T16:00:00-07:00`, source: "planner" }],
  weather: { tempF: 70, highF: 78, isHot: false },
  briefing: "Good morning, Alex. Not saved either.",
  aiUsed: true,
});

afterEach(() => {
  db = fakeDb;
  vi.clearAllMocks();
});

describe("savePlan", () => {
  it("stores only the day's date, items and weather, under calendarId:date, with an expiry", async () => {
    expect(await savePlan(ID, day("2026-11-16", "CSE 230"))).toBe(true);
    const [filter, doc, options] = replaceOne.mock.calls[0];
    expect(filter).toEqual({ _id: `${ID}:2026-11-16` });
    expect(options).toEqual({ upsert: true });
    expect(Object.keys(doc.plan).sort()).toEqual(["date", "items", "weather"]);
    expect(JSON.stringify(doc)).not.toContain("Not saved");
    expect(doc.expiresAt.toISOString()).toBe("2026-11-19T07:00:00.000Z"); // 3 days later, midnight in Arizona
  });

  it("returns false without a database or when the write fails", async () => {
    db = null;
    expect(await savePlan(ID, day("2026-11-16", "CSE 230"))).toBe(false);
    db = fakeDb;
    replaceOne.mockRejectedValueOnce(new Error("timeout"));
    expect(await savePlan(ID, day("2026-11-16", "CSE 230"))).toBe(false);
  });
});

describe("loadPlans and calendarIcs", () => {
  it("reads this calendar from yesterday on, and returns null without a database", async () => {
    toArray.mockResolvedValueOnce([{ plan: day("2026-11-16", "CSE 230") }]);
    expect(await loadPlans(ID, new Date("2026-11-16T09:00:00-07:00"))).toHaveLength(1);
    expect(find).toHaveBeenCalledWith({ calendarId: ID, date: { $gte: "2026-11-15" } });
    db = null;
    expect(await loadPlans(ID)).toBeNull();
  });

  it("merges several days into one calendar with unique event ids", () => {
    const ics = calendarIcs([day("2026-11-16", "CSE 230"), day("2026-11-17", "CSE 230 lab")], new Date("2026-11-16T09:00:00Z"));
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(ics.match(/END:VCALENDAR/g)).toHaveLength(1);
    const uids = ics.match(/^UID:.*$/gm) ?? [];
    expect(uids).toHaveLength(2);
    expect(new Set(uids).size).toBe(2);
    expect(ics).toContain("SUMMARY:CSE 230 lab");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2); // a leave-time reminder each day
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
