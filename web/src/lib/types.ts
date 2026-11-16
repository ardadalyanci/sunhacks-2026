// Shared data contract for Sundial. Every API route and page builds against these shapes.
// Only teammate A edits this file, after asking in the team chat (see CLAUDE.md).
// Times are ISO 8601 strings with the Arizona offset, e.g. "2026-11-18T18:00:00-07:00".

// One row on the Today timeline. Every source (Canvas, classes, events, planner) is turned into this.
export type DayItemType = "class" | "deadline" | "event" | "study_block" | "travel";
export type DayItemSource = "canvas" | "manual" | "asu_events" | "sundevilcentral" | "planner";

export interface DayItem {
  id: string;
  type: DayItemType;
  title: string;
  start: string; // ISO with -07:00; for a deadline, the due time
  end?: string;
  buildingId?: string; // key in data/buildings.json
  location?: string; // free text when there is no buildingId
  source: DayItemSource;
  done?: boolean; // Canvas: already submitted
  url?: string; // Canvas assignment or RSVP link
  tags?: string[]; // for interest matching
  leaveAt?: string; // set by /api/plan for classes and events: when to start walking
  why?: string; // set by /api/plan for events: one sentence on why it fits the student
  campus?: CampusId; // classes and events off the Tempe campus (absent = Tempe)
  via?: string; // set by /api/plan when the trip is not a campus walk: the ASU shuttle to take (or why none fits), or the trip from an off-campus home
}

/** How a student who lives off campus gets to campus; `minutes` is their own door-to-campus estimate. */
export type CommuteBy = "walk" | "bike" | "scooter" | "drive" | "bus";
export interface Commute {
  minutes: number; // 1 to 120
  by: CommuteBy;
}

/** ASU's metro campuses (see lib/campuses.ts). */
export type CampusId = "tempe" | "downtown" | "polytechnic" | "west";

export interface Weather {
  tempF: number;
  highF: number;
  isHot: boolean; // true at 95 °F or above
}

export interface DayPlan {
  date: string; // "2026-11-14"
  items: DayItem[]; // sorted by start
  suggestions: DayItem[]; // events that fit the student, best first, each with `why`; not on the timeline until accepted
  weather?: Weather;
  briefing: string; // spoken summary written by Gemini (or a template when Gemini is unavailable)
  aiUsed: boolean; // false when every Gemini step fell back to plain code
  calendarUrl?: string; // set when the request had a calendarId and the day was saved (MongoDB): subscribe to it in Google/Apple Calendar
}

// Body of POST /api/plan. Only `classes` is required.
export interface PlanRequest {
  date?: string; // "2026-11-14"; default: today in Arizona
  now?: string; // ISO; default: the server clock. Lets the demo replay a fixed moment.
  classes: ClassBlock[]; // ClassBlock.location like "BYENG 210" is matched to data/buildings.json
  deadlines?: DayItem[]; // from POST /api/canvas
  events?: Opportunity[]; // from GET /api/events
  acceptedEventIds?: string[]; // Opportunity ids the student added ("add to my day" or voice)
  interests?: string[];
  weather?: Weather; // from GET /api/weather
  startBuildingId?: string; // where the day starts, e.g. the dorm; used for the first leave time
  calendarId?: string; // a UUID the browser makes once (crypto.randomUUID) and keeps; saves the day for the calendar feed
  pace?: "slower"; // the student asked for more walking time (slower pace, a mobility aid, heat-sensitive): longer walks, more again in heat
  homeCampus?: CampusId; // where the day starts (with startBuildingId); absent = Tempe
  commute?: Commute; // the student lives off campus, near homeCampus: the first stop of the day is this trip, not a walk
}

// Result of POST /api/command: what the voice command asked for.
export type CommandAction =
  | { action: "add_event"; itemId: string }
  | { action: "remove_item"; itemId: string }
  | { action: "briefing"; reply?: string } // reply set → speak it ("Next: CSE 230 at 10:30 AM…"); else speak plan.briefing
  | { action: "unknown"; reply: string };

export type OpportunityKind =
  | "club_event"
  | "career_fair"
  | "employer_session"
  | "hackathon"
  | "internship"
  | "workshop"
  | "social";

export type OpportunitySource =
  | "asu_events"
  | "sundevilcentral"
  | "career_services"
  | "mlh"
  | "greenhouse"
  | "lever"
  | "tinyfish"
  | "seed";

export interface Opportunity {
  id: string;
  kind: OpportunityKind;
  title: string;
  organizer: string; // club, company or office name
  description: string;
  url: string; // real source link
  startsAt?: string; // events
  endsAt?: string;
  deadline?: string; // internships: application deadline
  location?: string; // room name or "Online"
  tags: string[]; // e.g. ["software", "networking", "soccer"]
  source: OpportunitySource;
  fetchedAt: string;
  campus?: "tempe" | "downtown" | "polytechnic" | "west" | "online"; // events: where it happens (feeds tag it; most club meetings default to Tempe)
}

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface ClassBlock {
  course: string; // e.g. "CSE 360"
  days: Weekday[];
  start: string; // local time "13:30"
  end: string; // local time "14:45"
  location?: string;
  campus?: CampusId; // absent = Tempe
}

export interface Student {
  id: string;
  name: string;
  major: string;
  year: "freshman" | "sophomore" | "junior" | "senior" | "masters" | "phd";
  careerGoals: string[]; // e.g. "SWE internship for summer 2027"
  interests: string[]; // social interests, e.g. "soccer", "anime"
  resumeText?: string; // extracted from the uploaded PDF
  classes: ClassBlock[];
  isInternational?: boolean; // optional, used only to surface relevant resources
  isFirstGen?: boolean; // optional, used only to surface relevant resources
}

export type Layer = "career" | "social";

export interface Recommendation {
  opportunityId: string;
  score: number; // 0..1
  layer: Layer;
  why: string; // one sentence written for the student
}

export interface PlanItem {
  opportunityId: string;
  startsAt: string;
  endsAt: string;
  layer: Layer;
}

export interface FutureSnapshot {
  label: string; // "May 2027, as is" or "May 2027, with Sunny's plan"
  headline: string;
  skills: string[];
  resumeLines: string[];
  peopleMet: number;
  opportunitiesUnlocked: string[];
}

export interface Futures {
  asIs: FutureSnapshot;
  withPlan: FutureSnapshot;
  basedOn: string[]; // ids of the opportunities the projection used
}
