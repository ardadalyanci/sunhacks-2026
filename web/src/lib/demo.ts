// Demo mode: one sample student and a full day of sample data, built for any date.
// Used by GET /api/demo and by POST /api/canvas when the token is "demo", so the expo demo works with
// no Canvas token, no event feeds and no Wi-Fi (Gemini falls back to plain code when offline).
// Every event here is invented for the demo; nothing claims to be a real ASU listing.
import { addDays, toMstIso, atTime, weekdayOf } from "./planner";
import type { ClassBlock, DayItem, Opportunity, PlanRequest } from "./types";

export const DEMO_TOKEN = "demo";

export const DEMO_PERSONA = {
  name: "Alex Rivera",
  major: "Computer Science",
  year: "sophomore",
  interests: ["robotics", "software", "hackathons"],
  startBuildingId: "Manzanita", // dorm
};

export interface DemoOptions {
  hot?: boolean; // a summer-like heat day, to show the heat warning
}

const at = (date: string, hhmm: string) => toMstIso(atTime(date, hhmm));

/** Three classes, all on `date`'s weekday, so the demo has a full day whatever day it runs. */
export function demoClasses(date: string): ClassBlock[] {
  const day = weekdayOf(date);
  return [
    { course: "CSE 230", days: [day], start: "10:30", end: "11:20", location: "BYENG 210" },
    { course: "MAT 343", days: [day], start: "13:30", end: "14:45", location: "COOR 170" },
    { course: "CSE 240", days: [day], start: "15:00", end: "15:50", location: "BYENG 190" },
  ];
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

export function demoEvents(date: string): Opportunity[] {
  const event = (id: string, title: string, start: string, end: string, location: string, tags: string[], source: Opportunity["source"]): Opportunity => ({
    id: `demo-${id}`,
    kind: tags.includes("career") ? "employer_session" : "club_event",
    title,
    organizer: "Demo data",
    description: "Sample event for the DayPilot demo.",
    url: source === "sundevilcentral" ? "https://sundevilcentral.eoss.asu.edu/events" : "https://asuevents.asu.edu/",
    startsAt: at(date, start),
    endsAt: at(date, end),
    location,
    tags,
    source,
    fetchedAt: at(date, "07:00"),
  });
  return [
    event("lunch-talk", "Lunch & learn: landing a software internship", "12:00", "12:50", "Memorial Union 202", ["career", "software"], "asu_events"),
    event("robotics", "Robotics club build night", "16:15", "17:30", "Memorial Union 230", ["robotics", "engineering"], "sundevilcentral"),
    event("mixer", "Hackathon team mixer", "17:45", "18:45", "Hayden Library", ["hackathons", "software", "social"], "sundevilcentral"),
    event("soccer", "Intramural soccer pickup game", "18:00", "19:00", "SDFC Fields", ["soccer", "sports"], "sundevilcentral"),
    event("poetry", "Poetry open mic", "19:30", "20:30", "Hayden Library", ["writing", "arts"], "asu_events"),
  ];
}

/** A complete PlanRequest for the demo student, as of 8:00 AM on `date`. */
export function demoScenario(date: string, options: DemoOptions = {}): { persona: typeof DEMO_PERSONA; request: PlanRequest } {
  return {
    persona: DEMO_PERSONA,
    request: {
      date,
      now: at(date, "08:00"),
      classes: demoClasses(date),
      deadlines: demoDeadlines(date),
      events: demoEvents(date),
      acceptedEventIds: [],
      interests: DEMO_PERSONA.interests,
      weather: options.hot ? { tempF: 104, highF: 109, isHot: true } : { tempF: 78, highF: 84, isHot: false },
      startBuildingId: DEMO_PERSONA.startBuildingId,
    },
  };
}
