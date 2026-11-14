// TEMPORARY: types from the first UI pass, kept only until the screens move to the DayPilot
// contract in web/src/lib/types.ts. Delete this file once nothing imports it.

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
  organizer: string;
  description: string;
  url: string;
  startsAt?: string;
  endsAt?: string;
  deadline?: string;
  location?: string;
  tags: string[];
  source: OpportunitySource;
  fetchedAt: string;
}

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface ClassBlock {
  course: string;
  days: Weekday[];
  start: string;
  end: string;
  location?: string;
}

export interface Student {
  id: string;
  name: string;
  major: string;
  year: "freshman" | "sophomore" | "junior" | "senior" | "masters" | "phd";
  careerGoals: string[];
  interests: string[];
  resumeText?: string;
  classes: ClassBlock[];
  isInternational?: boolean;
  isFirstGen?: boolean;
}

export type Layer = "career" | "social";

export interface Recommendation {
  opportunityId: string;
  score: number;
  layer: Layer;
  why: string;
}

export interface PlanItem {
  opportunityId: string;
  startsAt: string;
  endsAt: string;
  layer: Layer;
}

export interface FutureSnapshot {
  label: string;
  headline: string;
  skills: string[];
  resumeLines: string[];
  peopleMet: number;
  opportunitiesUnlocked: string[];
}

export interface Futures {
  asIs: FutureSnapshot;
  withPlan: FutureSnapshot;
  basedOn: string[];
}
