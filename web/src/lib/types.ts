// Shared data contract for DayPilot. API routes return these shapes; screens render them.
// Change only after telling the team (see CLAUDE.md).
// Times are ISO 8601 strings with the Arizona offset, e.g. "2026-11-16T13:30:00-07:00".

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

/** A class the student enters once during setup (MyASU has no API). */
export interface ClassBlock {
  course: string; // "CSE 240"
  days: Weekday[];
  start: string; // local "10:30"
  end: string; // local "11:45"
  building: string; // building code from buildings.json, e.g. "COOR"
  room?: string;
}

export interface Building {
  code: string; // "COOR"
  name: string; // "Lattie F. Coor Hall"
  lat: number;
  lng: number;
  airConditionedShortcut?: boolean;
}

export type DayItemKind =
  | "class"
  | "assignment" // due today or soon, from Canvas
  | "study" // block placed into a free gap for an assignment
  | "event" // a campus event the student added
  | "leave"; // "leave at 1:12 pm" marker before something with a location

export interface DayItem {
  id: string;
  kind: DayItemKind;
  title: string;
  startsAt?: string; // classes, study blocks, events, leave markers
  endsAt?: string;
  dueAt?: string; // assignments
  course?: string; // "CSE 240"
  building?: string; // building code
  location?: string; // free text when there is no building code
  submitted?: boolean; // assignments
  estimatedMinutes?: number; // assignments and study blocks (Gemini estimate)
  forItemId?: string; // study block → assignment id; leave marker → destination item id
  walkMinutes?: number; // leave markers
  url?: string; // Canvas assignment or event page
}

export type EventSource = "asu_events" | "sun_devil_central";

export interface CampusEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string; // Sun Devil Central hides most locations
  url: string; // event page or RSVP link
  source: EventSource;
  interests: string[]; // ASU Events "interests" field, or tags we derive
  description?: string;
}

export interface EventPick {
  event: CampusEvent;
  score: number; // 0..1 from Gemini ranking
  why: string; // one sentence written for the student
}

export interface HourlyWeather {
  time: string;
  tempF: number;
  feelsLikeF: number;
}

export interface Weather {
  hourly: HourlyWeather[]; // today, local hours
  highF: number;
}

export interface HeatAlert {
  at: string; // when it peaks during the student's walks
  feelsLikeF: number;
  message: string; // "Feels like 104°F when you walk to COOR at 1:15. Take water."
}

export interface DayPlan {
  date: string; // "2026-11-16"
  items: DayItem[]; // sorted by time
  heatAlert?: HeatAlert;
  briefing: string; // what the voice briefing reads out loud
}

export type CommandAction = "add_event" | "remove_item" | "briefing" | "next_item" | "none";

export interface CommandResult {
  action: CommandAction;
  id?: string; // CampusEvent id or DayItem id the action applies to
  say: string; // short spoken confirmation
}

/** Kept in the browser (localStorage). The Canvas token is sent per request and never stored server-side. */
export interface StudentSetup {
  name: string;
  classes: ClassBlock[];
  interests: string[];
}
