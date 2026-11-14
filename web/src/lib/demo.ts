// Demo mode: one sample student and a full day of sample data, built for any date.
// Used by POST /api/day (demo: true or Canvas token "demo"), GET /api/demo and POST /api/canvas with the
// token "demo", so the expo demo works with no Canvas token, no event feeds and no Wi-Fi (Gemini falls back
// to plain code when offline). Every event here is invented for the demo; nothing claims to be a real ASU listing.
import type { DayItem, Opportunity, PlanRequest } from "./engine-types";
import { addDays, atTime, toMstIso, weekdayOf } from "./planner";
import type { StudentSetup, Weather } from "./types";
import { engineClasses, engineWeather } from "./ui-adapter";

export const DEMO_TOKEN = "demo";

export const DEMO_PERSONA = {
  name: "Alex",
  major: "Computer Science",
  year: "sophomore",
  interests: ["Robotics", "Software", "Hackathons"],
  startBuildingId: "Manzanita", // dorm
};

export interface DemoOptions {
  hot?: boolean; // a summer-like heat day, to show the heat alert
}

const at = (date: string, hhmm: string) => toMstIso(atTime(date, hhmm));

/** The demo student's setup, in the public type. Classes fall on `date`'s weekday so any day has a full schedule. */
export function demoSetup(date: string): StudentSetup {
  const day = weekdayOf(date);
  return {
    name: DEMO_PERSONA.name,
    interests: DEMO_PERSONA.interests,
    classes: [
      { course: "CSE 230", days: [day], start: "10:30", end: "11:20", building: "BYENG", room: "210" },
      { course: "MAT 343", days: [day], start: "13:30", end: "14:45", building: "COOR", room: "170" },
      { course: "CSE 240", days: [day], start: "15:00", end: "15:50", building: "BYENG", room: "190" },
    ],
  };
}

/** Hourly feels-like temperatures for Tempe: a mild November day, or a 108 °F summer-like day with `hot`. */
export function demoWeather(date: string, hot = false): Weather {
  const curve = hot
    ? [84, 88, 92, 96, 99, 102, 104, 106, 107, 108, 108, 106, 103, 99, 95, 91]
    : [62, 65, 68, 71, 74, 77, 79, 80, 81, 81, 80, 78, 75, 72, 69, 66];
  return {
    highF: Math.max(...curve) - 2, // air temperature runs a little under feels-like
    hourly: curve.map((feelsLikeF, i) => ({ time: at(date, `${6 + i}:00`), tempF: feelsLikeF - 2, feelsLikeF })),
  };
}

/** What POST /api/canvas returns for the demo token: two open deadlines and one already submitted. */
export function demoDeadlines(date: string): DayItem[] {
  const deadline = (id: string, title: string, start: string, done: boolean): DayItem => ({
    id: `canvas-assignment-demo-${id}`,
    type: "deadline",
    title,
    start,
    source: "canvas",
    done,
  });
  return [
    deadline("1", "MAT 343: Homework 9", at(date, "17:00"), true),
    deadline("2", "CSE 230: Lab 7 (pipelining)", at(date, "23:59"), false),
    deadline("3", "ENG 102: Reading response", at(addDays(date, 1), "12:00"), false),
  ];
}

/** Five events on `date` and three later in the week. */
export function demoEvents(date: string): Opportunity[] {
  const event = (id: string, day: string, title: string, start: string, end: string, location: string, tags: string[], source: Opportunity["source"]): Opportunity => ({
    id: `demo-${id}`,
    kind: tags.includes("Career") ? "employer_session" : "club_event",
    title,
    organizer: "Demo data",
    description: "Sample event for the DayPilot demo.",
    url: source === "sundevilcentral" ? "https://sundevilcentral.eoss.asu.edu/events" : "https://asuevents.asu.edu/",
    startsAt: at(day, start),
    endsAt: at(day, end),
    location,
    tags,
    source,
    fetchedAt: at(date, "07:00"),
  });
  return [
    event("lunch-talk", date, "Lunch & learn: landing a software internship", "12:00", "12:50", "Memorial Union 202", ["Career", "Software"], "asu_events"),
    event("robotics", date, "Robotics club build night", "16:15", "17:30", "Memorial Union 230", ["Robotics", "Engineering"], "sundevilcentral"),
    event("mixer", date, "Hackathon team mixer", "17:45", "18:45", "Hayden Library", ["Hackathons", "Software", "Social"], "sundevilcentral"),
    event("soccer", date, "Intramural soccer pickup game", "18:00", "19:00", "SDFC Fields", ["Soccer", "Sports"], "sundevilcentral"),
    event("poetry", date, "Poetry open mic", "19:30", "20:30", "Hayden Library", ["Writing", "Arts"], "asu_events"),
    event("drone-demo", addDays(date, 1), "Drone racing demo night", "18:30", "20:00", "ISTB4 courtyard", ["Robotics", "Engineering"], "sundevilcentral"),
    event("hack-workshop", addDays(date, 2), "Intro to hackathons workshop", "17:00", "18:00", "Hayden Library", ["Hackathons", "Software"], "asu_events"),
    event("open-source", addDays(date, 4), "Open-source contribution sprint", "13:00", "16:00", "BYENG 210", ["Software"], "sundevilcentral"),
  ];
}

/** A complete engine PlanRequest for the demo student, as of 8:00 AM on `date` (used by GET /api/demo). */
export function demoScenario(date: string, options: DemoOptions = {}): { persona: typeof DEMO_PERSONA; request: PlanRequest } {
  const setup = demoSetup(date);
  return {
    persona: DEMO_PERSONA,
    request: {
      date,
      now: at(date, "08:00"),
      classes: engineClasses(setup.classes),
      deadlines: demoDeadlines(date),
      events: demoEvents(date),
      acceptedEventIds: [],
      interests: setup.interests,
      weather: engineWeather(demoWeather(date, options.hot)),
      startBuildingId: DEMO_PERSONA.startBuildingId,
    },
  };
}
