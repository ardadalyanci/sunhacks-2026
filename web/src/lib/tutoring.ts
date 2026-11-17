// ASU's free drop-in tutoring, matched to the student's open deadlines: which center covers the course, and when
// it is open while the student is free before the due time. Code does the math; the hours are hand-entered.
//
// Hours: the regular-semester schedules on tutoring.asu.edu/tutoring and tutoring.asu.edu/writing-centers, read
// Nov 16, 2026 (they change by term and close on holidays, so the screen links to the page). The engineering
// tutoring site blocks automated reads and lists no single schedule, so engineering courses get its link only.
// Tutors may not help with graded quizzes or exams (ASN policy), so those deadlines get no tutoring.
import { CLASS_TRAVEL_BUFFER_MIN, DAY_END, DAY_START, atTime, freeGaps, toMstIso, weekdayOf } from "./planner";
import type { CampusId, DayItem, TutoringHelp, Weekday } from "./types";

type Subject = "math" | "science" | "business" | "writing";
type Hours = Partial<Record<Weekday, [string, string]>>;
type Center = { name: string; place?: string; campus: CampusId | "online"; subjects: Subject[]; hours: Hours; url: string };

const SA_URL = "https://tutoring.asu.edu/tutoring";
const WRITING_URL = "https://tutoring.asu.edu/writing-centers";
export const ENGINEERING_URL = "https://tutoring.engineering.asu.edu/";

const weekdays = (open: string, close: string, friday?: [string, string]): Hours => ({
  Mon: [open, close],
  Tue: [open, close],
  Wed: [open, close],
  Thu: [open, close],
  ...(friday ? { Fri: friday } : {}),
});
const SA: Subject[] = ["math", "science", "business"];
const SMALL_CAMPUS = weekdays("11:00", "17:00", ["11:00", "15:00"]);

/** In the order they are offered: a subject's own center first, then the general ones, online last. */
export const CENTERS: Center[] = [
  { name: "Math Tutoring Center", place: "Wexler Hall 116", campus: "tempe", subjects: ["math"], hours: weekdays("10:00", "18:00", ["10:00", "15:00"]), url: SA_URL },
  { name: "W. P. Carey Tutoring Center", place: "BA 201", campus: "tempe", subjects: ["business"], hours: weekdays("11:00", "17:00", ["11:00", "15:00"]), url: SA_URL },
  { name: "Writing Center", place: "Noble Library 280", campus: "tempe", subjects: ["writing"], hours: weekdays("10:00", "17:00", ["10:00", "15:00"]), url: WRITING_URL },
  { name: "Tutoring Center", place: "Hayden Library, concourse level C-41", campus: "tempe", subjects: SA, hours: weekdays("10:00", "18:00", ["10:00", "15:00"]), url: SA_URL },
  { name: "Evening Tutoring Center", place: "Mesquite Hall F101, Hassayampa", campus: "tempe", subjects: SA, hours: weekdays("17:00", "22:00"), url: SA_URL },
  { name: "Evening Writing Center", place: "Mesquite Hall F101, Hassayampa", campus: "tempe", subjects: ["writing"], hours: weekdays("17:00", "21:00"), url: WRITING_URL },
  { name: "Tutoring and Writing Center", place: "UCENT 101", campus: "downtown", subjects: [...SA, "writing"], hours: SMALL_CAMPUS, url: SA_URL },
  { name: "Tutoring and Writing Center", place: "CNTR 160", campus: "polytechnic", subjects: [...SA, "writing"], hours: SMALL_CAMPUS, url: SA_URL },
  { name: "Tutoring and Writing Center", place: "Fletcher Library, 1st floor", campus: "west", subjects: [...SA, "writing"], hours: SMALL_CAMPUS, url: SA_URL },
  { name: "Online Tutoring Center (Zoom)", campus: "online", subjects: SA, hours: { ...weekdays("10:00", "22:00", ["10:00", "15:00"]), Sun: ["15:00", "22:00"] }, url: SA_URL },
  { name: "Online Writing Center (Zoom)", campus: "online", subjects: ["writing"], hours: { ...weekdays("10:00", "21:00", ["10:00", "15:00"]), Sun: ["17:00", "21:00"] }, url: WRITING_URL },
];

const PREFIXES: Record<Subject | "engineering", string[]> = {
  math: ["MAT", "STP"],
  science: ["PHY", "CHM", "BIO"],
  business: ["ACC", "CIS", "ECN", "FIN", "SCM"],
  writing: ["ENG", "WAC"],
  engineering: ["CSE", "CEN", "EEE", "MAE", "CEE", "CHE", "BME", "IEE", "SER", "FSE", "EGR"],
};

const MIN = 60_000;
export const MIN_HELP_MIN = 30; // a shorter overlap is not worth the walk to a drop-in center
const GRADED = /\b(quiz|exam|midterm|final|test)\b/i;

/** "MAT 343: Homework 9" → "math"; undefined when no center covers the course. */
export function subjectOf(title: string): Subject | "engineering" | undefined {
  const prefix = /^([A-Z]{2,4}) \d{3}/.exec(title.trim())?.[1];
  if (!prefix) return undefined;
  return (Object.keys(PREFIXES) as (Subject | "engineering")[]).find((s) => PREFIXES[s].includes(prefix));
}

/**
 * One tutoring pointer per open deadline, for the planned day: the first center that covers the course and is open
 * for at least 30 minutes while the student is free, between now and the due time. Study time for that same
 * assignment counts as free (that work can happen at the center). In person on the student's campus first, then
 * online. Engineering courses get the engineering tutoring link without times.
 */
export function tutoringHelp(deadlines: DayItem[], items: DayItem[], date: string, nowMs: number, campus: CampusId = "tempe"): TutoringHelp[] {
  const day = weekdayOf(date);
  const dayStart = Math.max(atTime(date, DAY_START).getTime(), nowMs);
  const dayEnd = atTime(date, DAY_END).getTime();
  const help: TutoringHelp[] = [];
  for (const d of deadlines) {
    const due = Date.parse(d.start);
    if (d.done || due <= nowMs || GRADED.test(d.title)) continue;
    const subject = subjectOf(d.title);
    if (!subject) continue;
    if (subject === "engineering") {
      help.push({ deadlineId: d.id, center: "Engineering Tutoring Centers", url: ENGINEERING_URL });
      continue;
    }
    const busy = items.filter((i) => i.type !== "deadline" && i.title !== `Work on: ${d.title}`);
    const free = freeGaps(dayStart, Math.min(dayEnd, due), busy, CLASS_TRAVEL_BUFFER_MIN);
    const centers = CENTERS.filter((c) => c.subjects.includes(subject) && c.hours[day]);
    const window = [...centers.filter((c) => c.campus === campus), ...centers.filter((c) => c.campus === "online")]
      .map((c) => {
        const [open, close] = c.hours[day]!.map((t) => atTime(date, t).getTime());
        const fit = free
          .map((g) => ({ start: Math.max(g.start, open), end: Math.min(g.end, close) }))
          .find((g) => g.end - g.start >= MIN_HELP_MIN * MIN);
        return fit && { c, fit };
      })
      .find(Boolean);
    if (!window) continue;
    help.push({
      deadlineId: d.id,
      center: window.c.name,
      ...(window.c.place ? { place: window.c.place } : {}),
      from: toMstIso(new Date(window.fit.start)),
      to: toMstIso(new Date(window.fit.end)),
      url: window.c.url,
    });
  }
  return help;
}
