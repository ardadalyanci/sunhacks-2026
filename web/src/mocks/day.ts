// MOCK DATA so the screens work before A's API routes exist. Not real Canvas or ASU data:
// never present it as real in the demo. Swap each export for the matching route (see CLAUDE.md).
import type { CampusEvent, DayItem, DayPlan, EventPick, HeatAlert, StudentSetup } from "@/lib/types";

export const demoDate = "2026-11-16"; // a Monday

const t = (hhmm: string) => `${demoDate}T${hhmm}:00-07:00`;

export const demoSetup: StudentSetup = {
  name: "Maya",
  interests: ["Robotics", "Soccer", "Hiking", "Meeting international students"],
  classes: [
    { course: "CSE 230", days: ["Mon", "Wed", "Fri"], start: "09:00", end: "09:50", building: "BYENG", room: "210" },
    { course: "MAT 343", days: ["Mon", "Wed", "Fri"], start: "12:00", end: "12:50", building: "WXLR", room: "A107" },
    { course: "ENG 102", days: ["Mon", "Wed"], start: "13:30", end: "14:45", building: "LL", room: "105" },
  ],
};

export const demoPlan: DayPlan = {
  date: demoDate,
  items: [
    { id: "leave-1", kind: "leave", title: "Leave for BYENG", startsAt: t("08:47"), walkMinutes: 9, forItemId: "class-cse230" },
    { id: "class-cse230", kind: "class", title: "CSE 230", course: "CSE 230", startsAt: t("09:00"), endsAt: t("09:50"), building: "BYENG", location: "BYENG 210" },
    { id: "study-lab7", kind: "study", title: "Work on Lab 7", course: "CSE 230", startsAt: t("10:00"), endsAt: t("11:30"), estimatedMinutes: 90, forItemId: "asg-lab7", location: "Noble Library" },
    { id: "leave-2", kind: "leave", title: "Leave for WXLR", startsAt: t("11:47"), walkMinutes: 11, forItemId: "class-mat343" },
    { id: "class-mat343", kind: "class", title: "MAT 343", course: "MAT 343", startsAt: t("12:00"), endsAt: t("12:50"), building: "WXLR", location: "WXLR A107" },
    { id: "leave-3", kind: "leave", title: "Leave for LL", startsAt: t("13:12"), walkMinutes: 14, forItemId: "class-eng102" },
    { id: "class-eng102", kind: "class", title: "ENG 102", course: "ENG 102", startsAt: t("13:30"), endsAt: t("14:45"), building: "LL", location: "LL 105" },
    { id: "study-ps9", kind: "study", title: "Start Problem Set 9", course: "MAT 343", startsAt: t("15:15"), endsAt: t("16:45"), estimatedMinutes: 90, forItemId: "asg-ps9", location: "Hayden Library" },
    { id: "asg-peer", kind: "assignment", title: "Draft 2 peer review", course: "ENG 102", dueAt: t("17:00"), submitted: true, url: "https://canvas.asu.edu" },
    { id: "event-robotics", kind: "event", title: "Robotics club build night", startsAt: t("18:00"), endsAt: t("19:30"), location: "Brickyard Engineering", url: "https://example.com/robotics-build-night" },
    { id: "asg-lab7", kind: "assignment", title: "Lab 7: Pipelines", course: "CSE 230", dueAt: t("23:59"), submitted: false, estimatedMinutes: 90, url: "https://canvas.asu.edu" },
  ],
  briefing:
    "Morning, Maya. Three classes today, and Lab 7 is due tonight, so I saved 90 minutes for it right after CSE 230. Leave Wexler at 1:12 to make ENG 102 on time. Robotics build night at 6 fits after your study block.",
};

export const demoDueSoon: DayItem[] = [
  { id: "asg-ps9", kind: "assignment", title: "Problem Set 9", course: "MAT 343", dueAt: "2026-11-17T23:59:00-07:00", submitted: false, estimatedMinutes: 120, url: "https://canvas.asu.edu" },
];

// What the heat alert looks like on a September day, for the demo toggle.
export const demoHotAlert: HeatAlert = {
  at: t("13:12"),
  feelsLikeF: 106,
  message: "Feels like 106°F when you walk to LL at 1:12. Take water, and check Cool Routes for a shaded path.",
};

const events: CampusEvent[] = [
  { id: "ev-robotics", title: "Robotics club build night", startsAt: t("18:00"), endsAt: t("19:30"), location: "Brickyard Engineering", url: "https://example.com/robotics-build-night", source: "sun_devil_central", interests: ["Robotics", "Engineering"] },
  { id: "ev-intl-coffee", title: "Coffee hour with international students", startsAt: t("16:45"), endsAt: t("17:45"), location: "Memorial Union", url: "https://example.com/intl-coffee", source: "asu_events", interests: ["Meeting international students", "Community"] },
  { id: "ev-soccer", title: "Intramural soccer, open play", startsAt: "2026-11-17T17:00:00-07:00", endsAt: "2026-11-17T18:00:00-07:00", location: "Rec fields", url: "https://example.com/soccer", source: "sun_devil_central", interests: ["Soccer", "Sports"] },
  { id: "ev-hack-night", title: "Hack night: ship a side project", startsAt: "2026-11-19T19:00:00-07:00", endsAt: "2026-11-19T21:00:00-07:00", location: "Hayden Library", url: "https://example.com/hack-night", source: "sun_devil_central", interests: ["Robotics", "Software"] },
  { id: "ev-hike", title: "Sunrise hike up A Mountain", startsAt: "2026-11-21T07:00:00-07:00", endsAt: "2026-11-21T09:00:00-07:00", location: "A Mountain trailhead", url: "https://example.com/sunrise-hike", source: "asu_events", interests: ["Hiking", "Outdoors"] },
];

export const demoPicks: EventPick[] = [
  { event: events[0], score: 0.93, why: "You picked robotics, and it starts after your last study block." },
  { event: events[1], score: 0.88, why: "You want to meet international students, and you are free between 4:45 and 5:45." },
  { event: events[2], score: 0.81, why: "You play soccer, and your Tuesday evening is open." },
  { event: events[3], score: 0.74, why: "A hands-on build night close to your robotics interest." },
  { event: events[4], score: 0.7, why: "A morning hike before the day warms up." },
];

export const demoBuildings = [
  { code: "BYENG", name: "Brickyard Engineering" },
  { code: "COOR", name: "Coor Hall" },
  { code: "ECG", name: "Engineering Center G Wing" },
  { code: "ISTB4", name: "Interdisciplinary Science and Technology Building 4" },
  { code: "LL", name: "Language and Literature" },
  { code: "MU", name: "Memorial Union" },
  { code: "PSH", name: "Physical Sciences H Wing" },
  { code: "WXLR", name: "Wexler Hall" },
];
