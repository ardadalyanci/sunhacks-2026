// Cleans untrusted JSON from the browser before the planner touches it. Broken entries are dropped
// instead of crashing the route; only a missing `classes` array is an error.
import type { ClassBlock, Commute, CommuteBy, DayItem, DayPlan, Opportunity, PlanRequest, Weather, Weekday } from "./types";
import { isCampus } from "./campuses";

const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LIMITS = { classes: 30, deadlines: 200, events: 1000, interests: 20, accepted: 50, items: 200 };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() && v.length <= max ? v.trim() : undefined;
const isoDate = (v: unknown): string | undefined =>
  typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : undefined;
const httpUrl = (v: unknown): string | undefined => {
  const s = str(v, 2000);
  return s && /^https?:\/\//i.test(s) ? s : undefined;
};
/** A browser-made calendar id (crypto.randomUUID): unguessable, so it can name a public calendar feed. */
export const isCalendarId = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);

/** A real "YYYY-MM-DD" calendar day ("2026-02-30" and "2026-13-01" are rejected). */
export function isCalendarDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** "9:05" or "13:30" → minutes after midnight, or null. */
function minutesOf(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

function cleanClass(v: unknown): ClassBlock | null {
  if (!isObj(v)) return null;
  const course = str(v.course, 60);
  const days = list(v.days, 7).filter((d): d is Weekday => WEEKDAYS.includes(d as Weekday));
  const start = minutesOf(v.start);
  const end = minutesOf(v.end);
  if (!course || !days.length || start === null || end === null || end <= start) return null;
  const campus = isCampus(v.campus) && v.campus !== "tempe" ? { campus: v.campus } : {};
  return { course, days, start: v.start as string, end: v.end as string, location: str(v.location, 80), ...campus };
}

function cleanDeadline(v: unknown): DayItem | null {
  if (!isObj(v) || v.type !== "deadline") return null;
  const id = str(v.id, 120);
  const title = str(v.title, 200);
  const start = isoDate(v.start);
  if (!id || !title || !start) return null;
  return { id, type: "deadline", title, start, source: "canvas", done: v.done === true, url: httpUrl(v.url) };
}

const COMMUTE_BY: CommuteBy[] = ["walk", "bike", "scooter", "drive", "bus"];

/** An off-campus student's trip to campus: whole minutes from 1 to 120, and how they travel. */
function cleanCommute(v: unknown): Commute | undefined {
  if (!isObj(v) || typeof v.minutes !== "number" || !Number.isFinite(v.minutes)) return undefined;
  if (!COMMUTE_BY.includes(v.by as CommuteBy)) return undefined;
  return { minutes: Math.min(120, Math.max(1, Math.round(v.minutes))), by: v.by as CommuteBy };
}

const EVENT_CAMPUSES = ["tempe", "downtown", "polytechnic", "west", "online"];

function cleanEvent(v: unknown): Opportunity | null {
  if (!isObj(v)) return null;
  const id = str(v.id, 120);
  const title = str(v.title, 200);
  const startsAt = isoDate(v.startsAt);
  if (!id || !title || !startsAt) return null;
  return {
    id,
    kind: (str(v.kind, 40) ?? "club_event") as Opportunity["kind"],
    title,
    organizer: str(v.organizer, 200) ?? "",
    description: str(v.description, 2000) ?? "",
    url: httpUrl(v.url) ?? "",
    startsAt,
    endsAt: isoDate(v.endsAt),
    location: str(v.location, 200),
    tags: list(v.tags, 20).filter((t): t is string => typeof t === "string" && t.length <= 60),
    source: v.source === "sundevilcentral" ? "sundevilcentral" : "asu_events",
    fetchedAt: isoDate(v.fetchedAt) ?? new Date(0).toISOString(),
    ...(EVENT_CAMPUSES.includes(v.campus as string) ? { campus: v.campus as Opportunity["campus"] } : {}),
  };
}

function cleanWeather(v: unknown): Weather | undefined {
  if (!isObj(v)) return undefined;
  const tempF = Number(v.tempF);
  const highF = Number(v.highF);
  if (!Number.isFinite(tempF) || !Number.isFinite(highF)) return undefined;
  return { tempF, highF, isHot: typeof v.isHot === "boolean" ? v.isHot : Math.max(tempF, highF) >= 95 };
}

export function sanitizePlanRequest(raw: unknown): { ok: true; value: PlanRequest } | { ok: false; error: string } {
  if (!isObj(raw) || !Array.isArray(raw.classes)) return { ok: false, error: "`classes` must be an array (it can be empty)." };
  const date = isCalendarDate(raw.date) ? raw.date : undefined;
  return {
    ok: true,
    value: {
      date,
      now: isoDate(raw.now),
      classes: list(raw.classes, LIMITS.classes).map(cleanClass).filter((c): c is ClassBlock => c !== null),
      deadlines: list(raw.deadlines, LIMITS.deadlines).map(cleanDeadline).filter((d): d is DayItem => d !== null),
      events: list(raw.events, LIMITS.events).map(cleanEvent).filter((e): e is Opportunity => e !== null),
      acceptedEventIds: list(raw.acceptedEventIds, LIMITS.accepted).filter((id): id is string => typeof id === "string" && id.length <= 130),
      interests: list(raw.interests, LIMITS.interests).map((i) => str(i, 40)).filter((i): i is string => Boolean(i)),
      weather: cleanWeather(raw.weather),
      startBuildingId: str(raw.startBuildingId, 80),
      calendarId: isCalendarId(raw.calendarId) ? raw.calendarId : undefined,
      pace: raw.pace === "slower" ? "slower" : undefined,
      homeCampus: isCampus(raw.homeCampus) ? raw.homeCampus : undefined,
      commute: cleanCommute(raw.commute),
    },
  };
}

/** The parts of a client-sent DayPlan that /api/command reads: ids, titles, times, and Sol's reason for a pick. */
export function sanitizePlanForCommand(raw: unknown): Pick<DayPlan, "items" | "suggestions"> {
  const plan = isObj(raw) ? raw : {};
  const pick = (v: unknown): DayItem | null => {
    if (!isObj(v)) return null;
    const id = str(v.id, 130);
    const title = str(v.title, 200);
    const type = v.type;
    if (!id || !title || typeof type !== "string") return null;
    const location = str(v.location, 120);
    const leaveAt = isoDate(v.leaveAt);
    const end = isoDate(v.end);
    const why = str(v.why, 200); // lets Sol answer "should I go to the lunch talk?" with his own reason
    const via = str(v.via, 400); // the shuttle or the trip from home, so a leave answer does not call it a walk
    return {
      id,
      title,
      type: type as DayItem["type"],
      start: isoDate(v.start) ?? "",
      source: "planner",
      ...(end ? { end } : {}),
      ...(location ? { location } : {}),
      ...(leaveAt ? { leaveAt } : {}),
      ...(why ? { why } : {}),
      ...(via ? { via } : {}),
    };
  };
  return {
    items: list(plan.items, LIMITS.items).map(pick).filter((i): i is DayItem => i !== null),
    suggestions: list(plan.suggestions, LIMITS.items).map(pick).filter((i): i is DayItem => i !== null),
  };
}
