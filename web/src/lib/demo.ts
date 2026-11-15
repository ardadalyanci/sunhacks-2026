// Demo mode: one sample student and a believable week of sample data, built for any date.
// Used by GET /api/demo and by POST /api/canvas when the token is "demo", so the expo demo works with
// no Canvas token, no event feeds and no Wi-Fi (Gemini falls back to plain code when offline).
// Every event here is invented for the demo (source "seed"); the UI labels them as sample events and mixes in
// the live ASU feeds when they answer. Nothing here claims to be a real ASU listing.
import { addDays, atTime, mstDate, toMstIso, weekdayOf } from "./planner";
import type { ClassBlock, DayItem, Opportunity, PlanRequest, Weekday } from "./types";

export const DEMO_TOKEN = "demo";

export const DEMO_PERSONA = {
  name: "Diego Ramírez",
  major: "Computer Science",
  year: "sophomore",
  interests: ["robotics", "software", "hackathons"],
  startBuildingId: "Manzanita", // dorm
};

export interface DemoOptions {
  hot?: boolean; // a summer-like heat day, to show the heat warning
  today?: string; // the real Arizona date that due dates are fixed to (default: now)
}

const at = (date: string, hhmm: string) => toMstIso(atTime(date, hhmm));

type Slot = { course: string; start: string; end: string; location: string };

// Alex's week. Weekdays follow ASU meeting patterns (MWF 50 minutes, TTh 75 minutes). Weekends have a study
// group and a shift instead of classes, so the demo still has walks to plan on a Saturday or Sunday (judging day).
const MWF: Slot[] = [
  { course: "CSE 230", start: "10:30", end: "11:20", location: "BYENG 210" },
  { course: "PHY 121", start: "12:15", end: "13:05", location: "PSF 166" },
  { course: "CSE 240", start: "15:00", end: "15:50", location: "BYENG 190" },
];
const TTH: Slot[] = [
  { course: "ENG 102", start: "09:00", end: "10:15", location: "LL 101" },
  { course: "MAT 343", start: "13:30", end: "14:45", location: "COOR 170" },
];
const WEEK: Record<Weekday, Slot[]> = {
  Mon: MWF,
  Tue: TTH,
  Wed: MWF,
  Thu: TTH,
  Fri: MWF,
  Sat: [
    { course: "Shift at the MU", start: "10:00", end: "14:00", location: "Memorial Union" },
    { course: "Study group: CSE 230", start: "15:00", end: "16:00", location: "Hayden Library" },
  ],
  Sun: [
    { course: "Study group: MAT 343", start: "10:30", end: "11:45", location: "Hayden Library" },
    { course: "Shift at the MU", start: "13:30", end: "16:00", location: "Memorial Union" },
  ],
};

/** What Alex has on `date`'s weekday: classes on weekdays, a study group and a shift on weekends. */
export function demoClasses(date: string): ClassBlock[] {
  const day = weekdayOf(date);
  return WEEK[day].map((s) => ({ ...s, days: [day] }));
}

/**
 * What POST /api/canvas returns for the demo token. Due dates are fixed to the real Arizona `today`, and like
 * Canvas for a real student only what is due from `date` to the end of the next day comes back, so Tomorrow
 * shows tomorrow's work instead of a second copy of tonight's lab.
 */
export function demoDeadlines(date: string, today = mstDate(new Date())): DayItem[] {
  const deadline = (id: string, title: string, start: string, done: boolean): DayItem => ({
    id: `canvas-assignment-demo-${id}`,
    type: "deadline",
    title,
    start,
    source: "canvas",
    done,
  });
  const all = [
    deadline("1", "MAT 343: Homework 9", at(today, "17:00"), true),
    deadline("2", "CSE 230: Lab 7 (pipelining)", at(today, "23:59"), false),
    deadline("3", "ENG 102: Reading response", at(addDays(today, 1), "12:00"), false),
    deadline("4", "CSE 240: Quiz 5 (pointers)", at(addDays(today, 2), "23:59"), false),
    deadline("5", "PHY 121: Problem set 8", at(addDays(today, 3), "23:59"), false),
  ];
  const from = atTime(date, "00:00").getTime();
  const to = atTime(addDays(date, 2), "00:00").getTime();
  return all.filter((d) => Date.parse(d.start) >= from && Date.parse(d.start) < to);
}

export function demoEvents(date: string): Opportunity[] {
  const event = (id: string, title: string, organizer: string, description: string, start: string, end: string, location: string, tags: string[]): Opportunity => ({
    id: `demo-${id}`,
    kind: tags.includes("career") ? "employer_session" : "club_event",
    title,
    organizer,
    description,
    url: "https://sundevilcentral.eoss.asu.edu/events",
    startsAt: at(date, start),
    endsAt: at(date, end),
    location,
    tags,
    source: "seed",
    fetchedAt: at(date, "07:00"),
  });
  return [
    event("lunch-talk", "Lunch & learn: landing a software internship", "Career coaching (sample)", "Résumés, the online assessment and your first technical interview, from students who interned last summer. Lunch provided.", "12:00", "12:50", "Memorial Union 202", ["career", "software"]),
    event("robotics", "Robotics club build night", "Robotics club (sample)", "Drive-train night for the spring competition bot. New members welcome, no experience needed; bring a laptop if you code.", "16:15", "17:30", "Memorial Union 230", ["robotics", "engineering"]),
    event("mixer", "Hackathon team mixer", "Hackathon club (sample)", "Pitch an idea or join one, then find teammates for the next hackathon. Pizza at 6.", "17:45", "18:45", "Hayden Library", ["hackathons", "software", "social"]),
    event("soccer", "Intramural soccer pickup game", "Rec sports (sample)", "Casual 7v7 on the SDFC fields under the lights. Bring water.", "18:00", "19:00", "SDFC Fields", ["soccer", "sports"]),
    event("poetry", "Poetry open mic", "Writers' circle (sample)", "Sign up at the door for five minutes on the mic, or just come and listen.", "19:30", "20:30", "Hayden Library", ["writing", "arts"]),
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
      deadlines: demoDeadlines(date, options.today),
      events: demoEvents(date),
      acceptedEventIds: [],
      interests: DEMO_PERSONA.interests,
      weather: options.hot ? { tempF: 104, highF: 109, isHot: true } : { tempF: 78, highF: 84, isHot: false },
      startBuildingId: DEMO_PERSONA.startBuildingId,
    },
  };
}
