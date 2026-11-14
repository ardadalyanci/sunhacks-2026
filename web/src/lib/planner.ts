// Pure planning math for POST /api/plan: no network, no Gemini. Everything here is deterministic,
// so the Today screen still works when Gemini is unavailable.
import type { ClassBlock, DayItem, Opportunity, Weather, Weekday } from "./types";

export const MST = "-07:00"; // Arizona: no daylight saving
const MST_MS = 7 * 60 * 60 * 1000;
const MIN = 60 * 1000;

export const DAY_START = "08:00";
export const DAY_END = "22:00";
export const CLASS_TRAVEL_BUFFER_MIN = 10; // keep this much free before every class when placing study blocks
const MIN_STUDY_BLOCK_MIN = 25;
const DEFAULT_STUDY_MIN = 60;
const DEFAULT_WALK_MIN = 10; // when a building is unknown
const WALK_M_PER_MIN = 80; // about 3 mph
const ROUTE_FACTOR = 1.3; // campus paths are not straight lines

export interface Building {
  id: string; // e.g. "BYENG"
  name: string; // e.g. "Brickyard Engineering"
  lat: number;
  lng: number;
  aliases?: string[];
}

// ---------- time helpers (all in Arizona time) ----------

/** "2026-11-14" for the Arizona calendar day of `d`. */
export function mstDate(d: Date): string {
  return new Date(d.getTime() - MST_MS).toISOString().slice(0, 10);
}

/** ISO string with the Arizona offset, e.g. "2026-11-14T13:30:00-07:00". */
export function toMstIso(d: Date): string {
  return new Date(d.getTime() - MST_MS).toISOString().slice(0, 19) + MST;
}

/** Date for a local "HH:MM" on an Arizona calendar day. */
export function atTime(date: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":");
  return new Date(`${date}T${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}:00${MST}`);
}

export function weekdayOf(date: string): Weekday {
  const names: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[new Date(`${date}T12:00:00${MST}`).getUTCDay()];
}

/** "1:12 PM" in Arizona time. */
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" });
}

export function addDays(date: string, days: number): string {
  return mstDate(new Date(atTime(date, "12:00").getTime() + days * 24 * 60 * MIN));
}

// ---------- buildings and walking ----------

/** Matches "BYENG", "BYENG 210", "Brickyard Engineering" or an alias, case-insensitively. */
export function findBuilding(buildings: Building[], ref?: string): Building | undefined {
  if (!ref) return undefined;
  const r = ref.trim().toLowerCase();
  if (!r) return undefined;
  const exact = buildings.find(
    (b) => b.id.toLowerCase() === r || b.name.toLowerCase() === r || b.aliases?.some((a) => a.toLowerCase() === r),
  );
  if (exact) return exact;
  return buildings.find(
    (b) =>
      r.startsWith(`${b.id.toLowerCase()} `) ||
      r.includes(b.name.toLowerCase()) ||
      b.aliases?.some((a) => r.includes(a.toLowerCase())),
  );
}

function metersBetween(a: Building, b: Building): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Minutes to walk between two buildings, plus a small buffer; a little more on hot days (slower pace, shade detours). */
export function walkMinutes(from: Building | undefined, to: Building | undefined, hot: boolean): number {
  if (!from || !to) return DEFAULT_WALK_MIN + (hot ? 2 : 0);
  const walk = (metersBetween(from, to) * ROUTE_FACTOR) / WALK_M_PER_MIN;
  return Math.max(3, Math.ceil(walk + 2 + (hot ? 2 : 0)));
}

// ---------- building the timeline ----------

export function classItems(classes: ClassBlock[], date: string, buildings: Building[]): DayItem[] {
  const day = weekdayOf(date);
  return classes
    .filter((c) => c.days.includes(day))
    .map((c, i) => ({
      id: `class-${i}-${c.course.replace(/\s+/g, "")}`,
      type: "class" as const,
      title: c.course,
      start: toMstIso(atTime(date, c.start)),
      end: toMstIso(atTime(date, c.end)),
      buildingId: findBuilding(buildings, c.location)?.id,
      location: c.location,
      source: "manual" as const,
    }));
}

export function opportunityToItem(o: Opportunity, buildings: Building[]): DayItem | null {
  if (!o.startsAt) return null;
  return {
    id: `ev-${o.id}`,
    type: "event",
    title: o.title,
    start: o.startsAt,
    end: o.endsAt ?? toMstIso(new Date(new Date(o.startsAt).getTime() + 60 * MIN)),
    buildingId: findBuilding(buildings, o.location)?.id,
    location: o.location,
    source: o.source === "sundevilcentral" ? "sundevilcentral" : "asu_events",
    url: o.url,
    tags: o.tags,
  };
}

interface Gap {
  start: number; // ms
  end: number;
}

/**
 * Free time between dayStart and dayEnd that is not taken by `busy`. A busy item is taken from its
 * `leaveAt` (the walk there) when known, otherwise from `bufferMin` before its start.
 */
export function freeGaps(dayStart: number, dayEnd: number, busy: DayItem[], bufferMin: number): Gap[] {
  const taken = busy
    .map((b) => ({
      start: b.leaveAt ? new Date(b.leaveAt).getTime() : new Date(b.start).getTime() - bufferMin * MIN,
      end: new Date(b.end ?? b.start).getTime(),
    }))
    .sort((a, b) => a.start - b.start);
  const gaps: Gap[] = [];
  let cursor = dayStart;
  for (const t of taken) {
    if (t.start > cursor) gaps.push({ start: cursor, end: Math.min(t.start, dayEnd) });
    cursor = Math.max(cursor, t.end);
    if (cursor >= dayEnd) break;
  }
  if (cursor < dayEnd) gaps.push({ start: cursor, end: dayEnd });
  return gaps.filter((g) => g.end - g.start > 0);
}

/** Events that start on `date`, after `now`, and fit completely inside a free gap. */
export function fittingEvents(events: DayItem[], gaps: Gap[], now: number): DayItem[] {
  return events.filter((e) => {
    const s = new Date(e.start).getTime();
    const end = new Date(e.end ?? e.start).getTime();
    return s >= now && gaps.some((g) => s >= g.start && end <= g.end);
  });
}

/**
 * Places study blocks for unfinished deadlines, earliest due first, into free gaps before each due time.
 * `minutesFor` gives the estimated work time per deadline id. Consumes the gaps it uses.
 */
export function placeStudyBlocks(
  deadlines: DayItem[],
  gaps: Gap[],
  now: number,
  minutesFor: (id: string) => number,
): DayItem[] {
  const blocks: DayItem[] = [];
  const open = deadlines
    .filter((d) => !d.done && new Date(d.start).getTime() > now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  for (const d of open) {
    const due = new Date(d.start).getTime();
    let need = minutesFor(d.id) * MIN;
    for (const g of gaps) {
      if (need <= 0) break;
      const from = Math.max(g.start, now);
      const to = Math.min(g.end, due);
      if (to - from < MIN_STUDY_BLOCK_MIN * MIN) continue;
      // Never leave a tiny leftover block: the last piece is at least MIN_STUDY_BLOCK_MIN long.
      const len = Math.min(Math.max(need, MIN_STUDY_BLOCK_MIN * MIN), to - from);
      blocks.push({
        id: `study-${d.id}-${blocks.length}`,
        type: "study_block",
        title: `Work on: ${d.title}`,
        start: toMstIso(new Date(from)),
        end: toMstIso(new Date(from + len)),
        source: "planner",
        url: d.url,
      });
      g.start = from + len; // the rest of the gap stays free
      need -= len;
    }
  }
  return blocks;
}

/** Sets `leaveAt` on classes and events, walking from the previous located stop (or the start building). */
export function addLeaveTimes(items: DayItem[], buildings: Building[], startBuildingId: string | undefined, weather?: Weather) {
  const hot = weather?.isHot ?? false;
  let here = findBuilding(buildings, startBuildingId);
  for (const item of items) {
    if (item.type !== "class" && item.type !== "event") continue;
    const there = findBuilding(buildings, item.buildingId ?? item.location);
    const minutes = walkMinutes(here, there, hot);
    item.leaveAt = toMstIso(new Date(new Date(item.start).getTime() - minutes * MIN));
    if (there) here = there;
  }
}

export function sortByStart(items: DayItem[]): DayItem[] {
  return [...items].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/** Fallback ranking without Gemini: count shared words between interests and the event's tags and title. */
export function rankByOverlap(events: DayItem[], interests: string[]): { item: DayItem; why: string }[] {
  const wanted = interests.map((i) => i.toLowerCase());
  return events
    .map((e) => {
      const hay = [...(e.tags ?? []), e.title].join(" ").toLowerCase();
      const hits = wanted.filter((w) => hay.includes(w));
      return { item: e, hits };
    })
    .filter((x) => x.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length)
    .map((x) => ({ item: x.item, why: `Matches your interest in ${x.hits.slice(0, 2).join(" and ")}.` }));
}

export function defaultStudyMinutes(): number {
  return DEFAULT_STUDY_MIN;
}

/** Spoken briefing without Gemini. */
export function templateBriefing(items: DayItem[], suggestions: DayItem[], weather?: Weather): string {
  const parts: string[] = [];
  if (weather) parts.push(`It's ${Math.round(weather.tempF)} degrees in Tempe today, with a high of ${Math.round(weather.highF)}${weather.isHot ? ", so stay in the shade and bring water" : ""}.`);
  const classes = items.filter((i) => i.type === "class");
  if (classes.length) {
    const first = classes[0];
    parts.push(`You have ${classes.length} class${classes.length > 1 ? "es" : ""}. First up is ${first.title} at ${clock(first.start)}${first.leaveAt ? `; leave by ${clock(first.leaveAt)}` : ""}.`);
  } else {
    parts.push("You have no classes today.");
  }
  const due = items.filter((i) => i.type === "deadline" && !i.done);
  if (due.length) parts.push(`${due.length} assignment${due.length > 1 ? "s are" : " is"} still open, starting with ${due[0].title}, due ${clock(due[0].start)}.`);
  if (suggestions.length) parts.push(`One event that fits you: ${suggestions[0].title} at ${clock(suggestions[0].start)}.`);
  return parts.join(" ");
}
