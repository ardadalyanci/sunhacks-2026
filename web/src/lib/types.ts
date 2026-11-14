// Shared data contract for Sunny. Every API route and page builds against these shapes.
// Only teammate A edits this file, after asking in the team chat (see CLAUDE.md).
// Times are ISO 8601 strings with the Arizona offset, e.g. "2026-11-18T18:00:00-07:00".

export type OpportunityKind =
  | "club_event"
  | "career_fair"
  | "employer_session"
  | "hackathon"
  | "internship"
  | "workshop"
  | "social";

export type OpportunitySource =
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
}

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface ClassBlock {
  course: string; // e.g. "CSE 360"
  days: Weekday[];
  start: string; // local time "13:30"
  end: string; // local time "14:45"
  location?: string;
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
