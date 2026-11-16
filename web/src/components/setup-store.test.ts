import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassBlock, DayItem } from "@/lib/types";
import { eventCampusQuery, forgetToken, itemKey, loadHidden, loadSetup, loadToken, saveHidden, saveSetup } from "./setup-store";

/** A Storage stand-in, since the tests run in Node. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
});
afterEach(() => vi.unstubAllGlobals());

const cse360: ClassBlock = { course: "CSE 360", days: ["Mon", "Wed"], start: "10:30", end: "11:45", location: "COOR 170" };

describe("loadSetup", () => {
  it("returns a good setup as it was saved", () => {
    const setup = { name: "Maya", classes: [cse360], interests: ["robotics"], startBuildingId: "TOOKR", pace: "slower" };
    localStorage.setItem("daypilot.setup", JSON.stringify(setup));
    expect(loadSetup()).toEqual(setup);
  });

  it("keeps other campuses and an off-campus commute through a save and a reload", () => {
    const poly: ClassBlock = { course: "EGR 104", days: ["Tue"], start: "11:30", end: "12:20", location: "Santan Hall 120", campus: "polytechnic" };
    const setup = { name: "Maya", classes: [cse360, poly], interests: [], homeCampus: "polytechnic" as const, commute: { minutes: 20, by: "bike" as const } };
    saveSetup(setup, "");
    expect(loadSetup()).toEqual(setup);
    // Tempe is the default, so it is not kept; a commute out of range or by an unknown way is dropped.
    localStorage.setItem(
      "daypilot.setup",
      JSON.stringify({ ...setup, classes: [{ ...poly, campus: "tempe" }], homeCampus: "mars", commute: { minutes: 500, by: "bike" } }),
    );
    const tempe: ClassBlock = { course: "EGR 104", days: ["Tue"], start: "11:30", end: "12:20", location: "Santan Hall 120" };
    expect(loadSetup()).toEqual({ name: "Maya", classes: [tempe], interests: [] });
  });

  it("keeps a home point from the map with its label, rounded, and drops one outside the Phoenix area", () => {
    const setup = { name: "", classes: [cse360], interests: [], commute: { by: "drive" as const, home: { lat: 33.432, lng: -111.945 } }, homeLabel: "Tempe Center for the Arts" };
    saveSetup(setup, "");
    expect(loadSetup()).toEqual(setup);
    localStorage.setItem("daypilot.setup", JSON.stringify({ ...setup, commute: { by: "drive", home: { lat: 32.22, lng: -110.97 } } }));
    expect(loadSetup()).toEqual({ name: "", classes: [cse360], interests: [] });
  });

  it("drops fields with the wrong type instead of crashing Today", () => {
    localStorage.setItem(
      "daypilot.setup",
      JSON.stringify({
        name: 42,
        classes: [{ course: 7, days: "Sun", start: 1030 }, cse360, { ...cse360, start: "10.30" }, { ...cse360, days: ["Funday"] }],
        interests: "robotics",
        pace: "turbo",
        startBuildingId: 5,
      }),
    );
    expect(loadSetup()).toEqual({ name: "", classes: [cse360], interests: [] });
  });

  it("is null when nothing usable is saved", () => {
    expect(loadSetup()).toBeNull();
    localStorage.setItem("daypilot.setup", "not json");
    expect(loadSetup()).toBeNull();
    localStorage.setItem("daypilot.setup", JSON.stringify({ name: "Maya", classes: [{ course: 7 }] }));
    expect(loadSetup()).toBeNull();
    localStorage.setItem("daypilot.setup", "null");
    expect(loadSetup()).toBeNull();
  });
});

describe("saveSetup", () => {
  const setup = { name: "Maya", classes: [cse360], interests: [] };

  it("keeps the saved Canvas token when the token field is left blank", () => {
    saveSetup(setup, "tok-1");
    saveSetup(setup, "");
    expect(loadToken()).toBe("tok-1");
    saveSetup(setup, "tok-2");
    expect(loadToken()).toBe("tok-2");
    forgetToken();
    expect(loadToken()).toBeNull();
  });
});

describe("hidden items", () => {
  const block = (start: string, end: string): DayItem => ({
    id: "study-a-0",
    type: "study_block",
    title: "Work on: CSE 230: Lab 7 (pipelining)",
    start: `2026-11-15T${start}:00-07:00`,
    end: `2026-11-15T${end}:00-07:00`,
    source: "planner",
  });

  it("remembers study time per assignment, so a re-planned block stays removed", () => {
    expect(itemKey(block("08:00", "10:00"))).toBe(itemKey(block("09:00", "10:16")));
  });

  it("remembers other items by their time", () => {
    const event: DayItem = { id: "ev-1", type: "event", title: "Robotics", start: "2026-11-15T16:00:00-07:00", source: "asu_events" };
    expect(itemKey(event)).not.toBe(itemKey({ ...event, start: "2026-11-15T18:00:00-07:00" }));
  });

  it("keeps removals for this tab only and forgets the old for-good list", () => {
    localStorage.setItem("daypilot.hidden", JSON.stringify({ "2026-11-15": ["old"] }));
    expect(loadHidden("2026-11-15")).toEqual([]);
    expect(localStorage.getItem("daypilot.hidden")).toBeNull();
    saveHidden("2026-11-15", [itemKey(block("08:00", "10:00"))]);
    expect(loadHidden("2026-11-15")).toEqual(["study_block|Work on: CSE 230: Lab 7 (pipelining)"]);
    expect(localStorage.getItem("daypilot.hidden")).toBeNull();
  });
});

describe("eventCampusQuery", () => {
  it("asks for the home campus and every class's campus, and nothing extra for an all-Tempe student", () => {
    expect(eventCampusQuery({ classes: [cse360] })).toBe("");
    expect(eventCampusQuery({ classes: [cse360], homeCampus: "polytechnic" })).toBe("?campus=polytechnic&campus=tempe");
    expect(eventCampusQuery({ classes: [{ ...cse360, campus: "downtown" }], homeCampus: "downtown" })).toBe("?campus=downtown");
  });
});
