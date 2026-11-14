// Cleans untrusted JSON from the browser before the planner touches it. Broken entries are dropped
// instead of crashing the route; only a missing `classes` array is an error.
import type { ClassBlock, DayItem, Opportunity, PlanRequest, Weather, Weekday } from "./engine-types";
import type * as UI from "./types";

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
  return { course, days, start: v.start as string, end: v.end as string, location: str(v.location, 80) };
}

function cleanDeadline(v: unknown): DayItem | null {
  if (!isObj(v) || v.type !== "deadline") return null;
  const id = str(v.id, 120);
  const title = str(v.title, 200);
  const start = isoDate(v.start);
  if (!id || !title || !start) return null;
  return { id, type: "deadline", title, start, source: "canvas", done: v.done === true, url: httpUrl(v.url) };
}

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
    },
  };
}

// ---------- public UI shapes (types.ts) ----------

/** A StudentSetup from the browser's localStorage, or null when it has no usable name/classes/interests. */
export function sanitizeSetup(raw: unknown): UI.StudentSetup | null {
  if (!isObj(raw)) return null;
  const classes = list(raw.classes, LIMITS.classes)
    .map((v): UI.ClassBlock | null => {
      if (!isObj(v)) return null;
      const engine = cleanClass(v);
      const building = str(v.building, 20)?.toUpperCase() ?? "";
      if (!engine) return null;
      return { course: engine.course, days: engine.days, start: engine.start, end: engine.end, building, room: str(v.room, 20) };
    })
    .filter((c): c is UI.ClassBlock => c !== null);
  const interests = list(raw.interests, LIMITS.interests).map((i) => str(i, 60)).filter((i): i is string => Boolean(i));
  const name = str(raw.name, 60) ?? "";
  if (!classes.length && !interests.length && !name) return null;
  return { name, classes, interests };
}

export interface CommandRequest {
  transcript: string;
  items: UI.DayItem[];
  picks: UI.CampusEvent[];
  briefing?: string;
  now?: string;
}

/** Body of POST /api/command; `text` is accepted as an alias of `transcript`. Null when there is nothing to do. */
export function sanitizeCommandRequest(raw: unknown): CommandRequest | null {
  if (!isObj(raw)) return null;
  const transcript = str(raw.transcript ?? raw.text, 300);
  if (!transcript) return null;
  const KINDS = ["class", "assignment", "study", "event", "leave"];
  const items = list(raw.items, LIMITS.items)
    .map((v): UI.DayItem | null => {
      if (!isObj(v) || !KINDS.includes(v.kind as string)) return null;
      const id = str(v.id, 130);
      const title = str(v.title, 200);
      if (!id || !title) return null;
      return { id, kind: v.kind as UI.DayItemKind, title, startsAt: isoDate(v.startsAt), endsAt: isoDate(v.endsAt), dueAt: isoDate(v.dueAt), forItemId: str(v.forItemId, 130) };
    })
    .filter((i): i is UI.DayItem => i !== null);
  const picks = list(raw.picks, LIMITS.items)
    .map((v): UI.CampusEvent | null => {
      // Accept either CampusEvent or EventPick ({ event }) entries.
      const e = isObj(v) && isObj(v.event) ? v.event : v;
      if (!isObj(e)) return null;
      const id = str(e.id, 130);
      const title = str(e.title, 200);
      const startsAt = isoDate(e.startsAt);
      if (!id || !title || !startsAt) return null;
      return { id, title, startsAt, url: httpUrl(e.url) ?? "", source: e.source === "sun_devil_central" ? "sun_devil_central" : "asu_events", interests: [] };
    })
    .filter((e): e is UI.CampusEvent => e !== null);
  return { transcript, items, picks, briefing: str(raw.briefing, 2000), now: isoDate(raw.now) };
}
