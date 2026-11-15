import { describe, expect, it } from "vitest";
import type { DayItem as EngineItem, DayPlan as EnginePlan } from "./engine-types";
import type { Weather } from "./types";
import { engineClasses, engineOpportunity, engineWeather, heatAlert, uiDueSoon, uiItems, uiPicks } from "./ui-adapter";

const e = (over: Partial<EngineItem>): EngineItem => ({ id: "x", type: "event", title: "X", start: "2026-11-16T10:00:00-07:00", source: "planner", ...over });

describe("UI → engine", () => {
  it("joins building and room into the engine location", () => {
    expect(
      engineClasses([
        { course: "CSE 230", days: ["Mon"], start: "09:00", end: "09:50", building: "BYENG", room: "210" },
        { course: "ENG 102", days: ["Tue"], start: "10:00", end: "11:15", building: "" },
      ]).map((c) => c.location),
    ).toEqual(["BYENG 210", undefined]);
  });

  it("maps CampusEvent sources and interests", () => {
    const o = engineOpportunity({ id: "e1", title: "T", startsAt: "2026-11-16T10:00:00-07:00", url: "https://x", source: "sun_devil_central", interests: ["Robotics"] });
    expect(o).toMatchObject({ id: "e1", source: "sundevilcentral", tags: ["Robotics"] });
  });

  it("uses the hottest daytime feels-like for the engine weather", () => {
    const w: Weather = {
      highF: 90,
      hourly: [
        { time: "2026-11-16T05:00:00-07:00", tempF: 99, feelsLikeF: 120 }, // before 8 AM: ignored
        { time: "2026-11-16T14:00:00-07:00", tempF: 92, feelsLikeF: 97 },
      ],
    };
    expect(engineWeather(w)).toEqual({ tempF: 97, highF: 97, isHot: true });
    expect(engineWeather(undefined)).toBeUndefined();
  });

  it("reads the current temperature at `now` and never reports a high below it", () => {
    const w: Weather = {
      highF: 79, // air high; feels-like peaks at 81
      hourly: [
        { time: "2026-11-16T08:00:00-07:00", tempF: 66, feelsLikeF: 68 },
        { time: "2026-11-16T14:00:00-07:00", tempF: 79, feelsLikeF: 81 },
      ],
    };
    expect(engineWeather(w, "2026-11-16T08:10:00-07:00")).toEqual({ tempF: 68, highF: 81, isHot: false });
    expect(engineWeather(w, "2026-11-16T13:40:00-07:00")).toEqual({ tempF: 81, highF: 81, isHot: false });
  });
});

describe("engine → UI", () => {
  const plan: EnginePlan = {
    date: "2026-11-16",
    aiUsed: false,
    briefing: "",
    suggestions: [],
    items: [
      e({ id: "class-0-CSE230", type: "class", title: "CSE 230", start: "2026-11-16T10:30:00-07:00", end: "2026-11-16T11:20:00-07:00", buildingId: "BYENG", location: "BYENG 210", leaveAt: "2026-11-16T10:14:00-07:00" }),
      e({ id: "study-a-0", type: "study_block", title: "Work on: CSE 230: Lab 7", start: "2026-11-16T08:00:00-07:00", end: "2026-11-16T09:30:00-07:00", forItemId: "a" }),
      e({ id: "a", type: "deadline", title: "CSE 230: Lab 7", start: "2026-11-16T23:59:00-07:00", done: false, estimatedMinutes: 90, url: "https://canvas.test/a" }),
      e({ id: "ev-demo-x", type: "event", title: "Mixer", start: "2026-11-16T17:00:00-07:00", end: "2026-11-16T18:00:00-07:00", location: "Online" }),
    ],
  };

  it("maps every item kind and inserts leave markers before stops", () => {
    expect(uiItems(plan)).toEqual([
      { id: "study-a-0", kind: "study", title: "Work on Lab 7", course: "CSE 230", startsAt: "2026-11-16T08:00:00-07:00", endsAt: "2026-11-16T09:30:00-07:00", estimatedMinutes: 90, forItemId: "a", url: undefined },
      { id: "leave-class-0-CSE230", kind: "leave", title: "Leave for BYENG", startsAt: "2026-11-16T10:14:00-07:00", walkMinutes: 16, forItemId: "class-0-CSE230" },
      { id: "class-0-CSE230", kind: "class", title: "CSE 230", course: "CSE 230", startsAt: "2026-11-16T10:30:00-07:00", endsAt: "2026-11-16T11:20:00-07:00", building: "BYENG", location: "BYENG 210" },
      { id: "event-demo-x", kind: "event", title: "Mixer", startsAt: "2026-11-16T17:00:00-07:00", endsAt: "2026-11-16T18:00:00-07:00", building: undefined, location: "Online", url: undefined },
      { id: "a", kind: "assignment", title: "Lab 7", course: "CSE 230", dueAt: "2026-11-16T23:59:00-07:00", submitted: false, estimatedMinutes: 90, url: "https://canvas.test/a" },
    ]);
  });

  it("lists only later deadlines as due soon", () => {
    const deadlines = [e({ id: "today", type: "deadline", title: "A", start: "2026-11-16T23:59:00-07:00" }), e({ id: "tomorrow", type: "deadline", title: "MAT 343: B", start: "2026-11-17T12:00:00-07:00" })];
    expect(uiDueSoon(deadlines, "2026-11-16").map((d) => [d.id, d.course, d.title])).toEqual([["tomorrow", "MAT 343", "B"]]);
  });

  it("orders picks: today's suggestions, then later matches by interest", () => {
    const picks = uiPicks(
      [e({ id: "ev-a", title: "Robotics night", why: "Robots!", source: "sundevilcentral" })],
      [e({ id: "ev-b", title: "Poetry", tags: ["writing"] }), e({ id: "ev-c", title: "Drone race", tags: ["robotics"] })],
      ["robotics"],
    );
    expect(picks.map((p) => [p.event.id, p.event.source, p.why])).toEqual([
      ["a", "sun_devil_central", "Robots!"],
      ["c", "asu_events", "Matches your interest in robotics."],
    ]);
    expect(picks[0].score).toBeGreaterThan(picks[1].score);
  });

  it("raises a heat alert only for a walk at 95 °F feels-like or more", () => {
    const items = uiItems(plan);
    const weather = (feels: number): Weather => ({ highF: feels, hourly: [{ time: "2026-11-16T10:00:00-07:00", tempF: feels, feelsLikeF: feels }] });
    expect(heatAlert(items, weather(90))).toBeUndefined();
    expect(heatAlert(items, weather(104))).toEqual({
      at: "2026-11-16T10:14:00-07:00",
      feelsLikeF: 104,
      message: "Feels like 104°F when you walk to BYENG at 10:14 AM. Take water, and check Cool Routes for a shaded path.",
    });
    expect(heatAlert(items, undefined)).toBeUndefined();
  });
});
