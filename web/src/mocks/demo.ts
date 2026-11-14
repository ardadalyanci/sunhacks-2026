// MOCK DATA so the UI can be built before the backend is ready.
// Swap each export for the matching API response (TASKS.md, list A). These are not real ASU events:
// never show them in the demo as real. Real opportunities come from data/seed-events.json and the agents.
import type { Futures, Opportunity, PlanItem, Recommendation, Student } from "./legacy-types";

export const demoWeekStart = "2026-11-16"; // Monday

export const demoStudent: Student = {
  id: "demo-maya",
  name: "Maya",
  major: "Computer Science",
  year: "sophomore",
  careerGoals: ["Software engineering internship for summer 2027"],
  interests: ["soccer", "hiking", "meeting other first-gen students"],
  classes: [
    { course: "CSE 230", days: ["Mon", "Wed", "Fri"], start: "09:00", end: "09:50", location: "BYENG 210" },
    { course: "CSE 240", days: ["Tue", "Thu"], start: "10:30", end: "11:45", location: "COOR 170" },
    { course: "MAT 343", days: ["Mon", "Wed", "Fri"], start: "12:00", end: "12:50", location: "WXLR A107" },
    { course: "ENG 102", days: ["Tue", "Thu"], start: "13:30", end: "14:45", location: "LL 105" },
  ],
  isFirstGen: true,
};

const fetchedAt = "2026-11-14T15:00:00-07:00";

export const demoOpportunities: Opportunity[] = [
  {
    id: "o1",
    kind: "workshop",
    title: "Resume review night",
    organizer: "CS student club",
    description: "Bring a printed resume. Two industry recruiters give line-by-line feedback.",
    url: "https://example.com/resume-night",
    startsAt: "2026-11-16T18:00:00-07:00",
    endsAt: "2026-11-16T19:30:00-07:00",
    location: "Memorial Union 202",
    tags: ["resume", "internships", "software"],
    source: "seed",
    fetchedAt,
  },
  {
    id: "o2",
    kind: "social",
    title: "Intramural soccer, open play",
    organizer: "Campus recreation",
    description: "Drop-in 7v7. No team needed.",
    url: "https://example.com/soccer",
    startsAt: "2026-11-17T17:00:00-07:00",
    endsAt: "2026-11-17T18:00:00-07:00",
    location: "Rec fields",
    tags: ["soccer", "sports"],
    source: "seed",
    fetchedAt,
  },
  {
    id: "o3",
    kind: "career_fair",
    title: "Engineering career fair",
    organizer: "Career center",
    description: "60+ employers hiring interns and new grads in software, hardware and data.",
    url: "https://example.com/career-fair",
    startsAt: "2026-11-18T14:00:00-07:00",
    endsAt: "2026-11-18T16:00:00-07:00",
    location: "Student Pavilion",
    tags: ["career fair", "internships"],
    source: "seed",
    fetchedAt,
  },
  {
    id: "o4",
    kind: "workshop",
    title: "Hack night: ship a portfolio project",
    organizer: "Hack club",
    description: "Pair up and build something you can put on your resume by midnight.",
    url: "https://example.com/hack-night",
    startsAt: "2026-11-19T19:00:00-07:00",
    endsAt: "2026-11-19T21:00:00-07:00",
    location: "Hayden Library, makerspace",
    tags: ["projects", "software", "teamwork"],
    source: "seed",
    fetchedAt,
  },
  {
    id: "o5",
    kind: "social",
    title: "First-gen student mixer",
    organizer: "First-gen student center",
    description: "Snacks, board games and upperclassmen who have been where you are.",
    url: "https://example.com/first-gen-mixer",
    startsAt: "2026-11-20T16:00:00-07:00",
    endsAt: "2026-11-20T17:30:00-07:00",
    location: "Student Pavilion, room 105",
    tags: ["first-gen", "community"],
    source: "seed",
    fetchedAt,
  },
  {
    id: "o6",
    kind: "social",
    title: "Sunrise hike up A Mountain",
    organizer: "Outdoors club",
    description: "Meet at the trailhead with water. Back in time for breakfast.",
    url: "https://example.com/sunrise-hike",
    startsAt: "2026-11-21T08:00:00-07:00",
    endsAt: "2026-11-21T10:00:00-07:00",
    location: "A Mountain trailhead",
    tags: ["hiking", "outdoors"],
    source: "seed",
    fetchedAt,
  },
  {
    id: "o7",
    kind: "internship",
    title: "Software engineering intern, summer 2027",
    organizer: "Phoenix-area tech company",
    description: "12-week paid internship on a product team. Sophomores and juniors welcome.",
    url: "https://example.com/swe-intern",
    deadline: "2026-11-30T23:59:00-07:00",
    tags: ["internships", "software"],
    source: "seed",
    fetchedAt,
  },
  {
    id: "o8",
    kind: "hackathon",
    title: "Spring hackathon applications",
    organizer: "Regional student hackathon",
    description: "36 hours, travel stipends for first-time hackers.",
    url: "https://example.com/spring-hackathon",
    deadline: "2026-12-05T23:59:00-07:00",
    tags: ["hackathon", "projects"],
    source: "seed",
    fetchedAt,
  },
];

export const demoRecommendations: Recommendation[] = [
  {
    opportunityId: "o3",
    score: 0.94,
    layer: "career",
    why: "Twelve of the employers list software internships, and it starts right after your ENG 102 lets out.",
  },
  {
    opportunityId: "o1",
    score: 0.91,
    layer: "career",
    why: "Your resume has no projects yet. Fix that before Wednesday’s career fair.",
  },
  {
    opportunityId: "o4",
    score: 0.86,
    layer: "career",
    why: "One evening gives you the portfolio project recruiters will ask about.",
  },
  {
    opportunityId: "o7",
    score: 0.84,
    layer: "career",
    why: "Matches your summer 2027 goal and takes sophomores. Apply before Nov 30.",
  },
  {
    opportunityId: "o5",
    score: 0.8,
    layer: "social",
    why: "You said you want to meet other first-gen students. This is the room for that.",
  },
  {
    opportunityId: "o2",
    score: 0.77,
    layer: "social",
    why: "You play soccer and your Tuesday evening is free.",
  },
  {
    opportunityId: "o6",
    score: 0.7,
    layer: "social",
    why: "A hike with people who like the outdoors as much as you do.",
  },
  {
    opportunityId: "o8",
    score: 0.66,
    layer: "career",
    why: "First-timer friendly, and a hackathon project is the fastest resume line there is.",
  },
];

export const demoPlan: PlanItem[] = [
  { opportunityId: "o1", startsAt: "2026-11-16T18:00:00-07:00", endsAt: "2026-11-16T19:30:00-07:00", layer: "career" },
  { opportunityId: "o2", startsAt: "2026-11-17T17:00:00-07:00", endsAt: "2026-11-17T18:00:00-07:00", layer: "social" },
  { opportunityId: "o3", startsAt: "2026-11-18T14:00:00-07:00", endsAt: "2026-11-18T16:00:00-07:00", layer: "career" },
  { opportunityId: "o4", startsAt: "2026-11-19T19:00:00-07:00", endsAt: "2026-11-19T21:00:00-07:00", layer: "career" },
  { opportunityId: "o5", startsAt: "2026-11-20T16:00:00-07:00", endsAt: "2026-11-20T17:30:00-07:00", layer: "social" },
  { opportunityId: "o6", startsAt: "2026-11-21T08:00:00-07:00", endsAt: "2026-11-21T10:00:00-07:00", layer: "social" },
];

export const demoFutures: Futures = {
  asIs: {
    label: "May 2027, as is",
    headline: "Good grades, a resume with coursework on it, and internship applications that never hear back.",
    skills: ["Java", "Data structures", "Linear algebra"],
    resumeLines: ["Coursework: CSE 230, CSE 240, MAT 343"],
    peopleMet: 3,
    opportunitiesUnlocked: [],
  },
  withPlan: {
    label: "May 2027, with Sunny’s plan",
    headline: "A shipped project, two recruiters who know your name, and an internship interview on the calendar.",
    skills: ["Java", "React", "Git and code review", "Pitching your work"],
    resumeLines: [
      "Built and shipped a portfolio project at hack night, team of 3",
      "Resume reviewed by two industry recruiters",
      "Spring hackathon participant",
    ],
    peopleMet: 26,
    opportunitiesUnlocked: ["Engineering career fair", "Hack night", "Spring hackathon"],
  },
  basedOn: ["o1", "o3", "o4", "o8"],
};

export function opportunityById(id: string) {
  return demoOpportunities.find((o) => o.id === id);
}

export function recommendationFor(id: string) {
  return demoRecommendations.find((r) => r.opportunityId === id);
}
