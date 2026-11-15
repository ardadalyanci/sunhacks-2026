// Pure planning math for POST /api/plan: no network, no Gemini. Everything here is deterministic,
// so the Today screen still works when Gemini is unavailable.
import { placeLabel, spokenAssignment, spokenStop } from "./places";
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
const SLOWER_PACE_FACTOR = 1.35; // "Give me more time to walk" in Setup
const HEAT_EXTRA_MIN = 2;
const HEAT_EXTRA_SLOWER_MIN = 5;

// A class is a course code and nothing else ("CSE 230", "BIO 181L"). "MAT 343 study group" or "Work shift" is a
// commitment the student added, and Sol calls it by its own name.
const COURSE_CODE = /^[A-Z]{2,4} \d{3}[A-Z]?$/;

export function isCourse(title: string): boolean {
  return COURSE_CODE.test(title.trim());
}

/** How Sol names a stop in a sentence: "CSE 230", "your work shift", "your MAT 343 study group", an event's title. */
export function stopName(item: DayItem): string {
  const name = spokenStop(item.title);
  if (item.type !== "class" || isCourse(name)) return name;
  return `your ${/^[A-Z][a-z]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name}`;
}

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

/** True when `needle` appears in `hay` as whole words ("mu" is in "MU 202" but not in "Music"). */
export function hasPhrase(hay: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(hay.toLowerCase());
}

/**
 * Matches "BYENG", "BYENG 210", "Brickyard Engineering" or an alias as whole words, case-insensitively.
 * When several buildings match, the longest matching name wins ("Memorial Union" beats "MU").
 */
export function findBuilding(buildings: Building[], ref?: string): Building | undefined {
  if (!ref?.trim() || isOnline(ref)) return undefined;
  let best: { b: Building; len: number } | undefined;
  for (const b of buildings) {
    for (const needle of [b.id, b.name, ...(b.aliases ?? [])]) {
      if (hasPhrase(ref, needle) && (!best || needle.length > best.len)) best = { b, len: needle.length };
    }
  }
  return best?.b;
}

/** "Online", "Zoom", "Virtual" and similar: no walking needed. */
export function isOnline(location?: string): boolean {
  return Boolean(location && /\b(online|zoom|virtual|remote|teams|webinar)\b/i.test(location));
}

function metersBetween(a: Building, b: Building): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/**
 * Minutes to walk between two buildings, plus a small buffer; a little more on hot days (slower pace, shade detours).
 * `slower` is the student's own pace setting (a slower walk, a mobility aid, heat sensitivity): the walk itself
 * takes 35% longer, and a hot day adds 5 minutes instead of 2, because they are in the sun longer and may need a
 * shade stop on the way.
 */
export function walkMinutes(from: Building | undefined, to: Building | undefined, hot: boolean, slower = false): number {
  const pace = slower ? SLOWER_PACE_FACTOR : 1;
  const heat = hot ? (slower ? HEAT_EXTRA_SLOWER_MIN : HEAT_EXTRA_MIN) : 0;
  if (!from || !to) return Math.ceil(DEFAULT_WALK_MIN * pace) + heat;
  const walk = ((metersBetween(from, to) * ROUTE_FACTOR) / WALK_M_PER_MIN) * pace;
  return Math.max(3, Math.ceil(walk + 2 + heat));
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

/** Events after `now` that fit completely inside a free gap, including the walk there. */
export function fittingEvents(events: DayItem[], gaps: Gap[], now: number, travelMin: number): DayItem[] {
  return events.filter((e) => {
    // Leave room to walk there after the previous stop (gap ends already allow the walk to the next class).
    const leave = new Date(e.start).getTime() - (isOnline(e.location) ? 0 : travelMin * MIN);
    const end = new Date(e.end ?? e.start).getTime();
    return leave >= now && gaps.some((g) => leave >= g.start && end <= g.end);
  });
}

/** Removes [start, end) from the gaps in place, splitting a gap when the window sits in its middle. */
export function reserveTime(gaps: Gap[], start: number, end: number) {
  for (let i = gaps.length - 1; i >= 0; i--) {
    const g = gaps[i];
    if (end <= g.start || start >= g.end) continue;
    const pieces = [
      { start: g.start, end: Math.min(start, g.end) },
      { start: Math.max(end, g.start), end: g.end },
    ].filter((p) => p.end > p.start);
    gaps.splice(i, 1, ...pieces);
  }
}

/**
 * Places study blocks for unfinished deadlines, earliest due first, into free gaps before each due time.
 * `minutesFor` gives the estimated work time per deadline id. Consumes the gaps it uses.
 * Never places more than the estimate: a 45-minute reading is one 45-minute block, not a padded hour. A split
 * leaves no piece shorter than MIN_STUDY_BLOCK_MIN; if the time before the due date runs out, a shorter total is
 * better than made-up work.
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
  const shortest = MIN_STUDY_BLOCK_MIN * MIN;

  for (const d of open) {
    const due = new Date(d.start).getTime();
    const estimate = minutesFor(d.id);
    let need = (Number.isFinite(estimate) && estimate > 0 ? estimate : DEFAULT_STUDY_MIN) * MIN;
    const place = (g: Gap, from: number, len: number) => {
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
    };
    const roomIn = (g: Gap) => {
      const from = Math.max(g.start, now);
      return { from, room: Math.min(g.end, due) - from };
    };

    for (const g of [...gaps].sort((a, b) => a.start - b.start)) {
      if (need <= 0) break;
      const { from, room } = roomIn(g);
      if (room < shortest) continue;
      if (need <= room) place(g, from, need); // the rest fits here
      else if (need - room >= shortest) place(g, from, room); // fill the gap; a full block is still left for later
      else if (need >= 2 * shortest) place(g, from, need - shortest); // leave exactly one full block for later
      // else: too little to split, so look for a later gap that holds all of it
    }
    // Nothing later held what was left: the biggest piece that fits, in the roomiest gap. A shortfall, never padding.
    if (need > 0) {
      let best: { g: Gap; from: number; room: number } | undefined;
      for (const g of gaps) {
        const r = roomIn(g);
        if (r.room >= shortest && (!best || r.room > best.room)) best = { g, ...r };
      }
      if (best) place(best.g, best.from, Math.min(need, best.room));
    }
  }
  return blocks;
}

/**
 * Sets `leaveAt` on classes and events, walking from the previous located stop (or the start building).
 * `slower` gives every walk the student's slower pace (see walkMinutes).
 * Another room in the same building is no walk, so that stop gets no leave time. When a walk has to start before
 * the stop before it ends (a slower pace or the heat on a short break), the leave time stays honest and `why` says
 * so, starting with "Tight:".
 */
export function addLeaveTimes(
  items: DayItem[],
  buildings: Building[],
  startBuildingId: string | undefined,
  weather?: Weather,
  slower = false,
) {
  const hot = weather?.isHot ?? false;
  let here = findBuilding(buildings, startBuildingId);
  let lastStop = here; // the building of the stop just before (undefined when that place is unknown)
  let prev: DayItem | undefined;
  for (const item of items) {
    if (item.type !== "class" && item.type !== "event") continue;
    if (item.why?.startsWith("Tight:")) delete item.why; // from an earlier plan of the same day
    const before = prev;
    prev = item;
    if (isOnline(item.location)) {
      delete item.leaveAt; // nothing to walk to; the student stays where they are
      continue;
    }
    const there = findBuilding(buildings, item.buildingId ?? item.location);
    const sameBuilding = lastStop && there && lastStop.id === there.id;
    lastStop = there;
    if (sameBuilding) {
      delete item.leaveAt; // down the hall, not a walk
      continue;
    }
    const leave = new Date(item.start).getTime() - walkMinutes(here, there, hot, slower) * MIN;
    item.leaveAt = toMstIso(new Date(leave));
    if (there) here = there;
    // Only a real squeeze: a stop that starts before the one before it ends is a clash, not a tight walk.
    const beforeEnd = before ? new Date(before.end ?? before.start).getTime() : Number.NaN;
    if (before && leave < beforeEnd && new Date(item.start).getTime() >= beforeEnd) {
      const short = Math.ceil((beforeEnd - leave) / MIN);
      item.why = `Tight: that is ${short} minute${short === 1 ? "" : "s"} before ${stopName(before)} ends.`;
    }
  }
}

export function sortByStart(items: DayItem[]): DayItem[] {
  return [...items].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/** Fallback ranking without Gemini: interests that appear as whole words in the event's tags or title. */
/**
 * At most `max` events to offer Gemini: the ones that match the interests first, then the rest by start time.
 * Returned in time order. On a busy real day (80+ events) this keeps evening events that fit from being cut.
 */
export function pickCandidates(events: DayItem[], interests: string[], max: number): DayItem[] {
  const wanted = interests.map((i) => i.toLowerCase());
  const byStart = (a: DayItem, b: DayItem) => Date.parse(a.start) - Date.parse(b.start);
  return events
    .map((item) => ({ item, hits: wanted.filter((w) => hasPhrase([...(item.tags ?? []), item.title].join(" | "), w)).length }))
    .sort((a, b) => b.hits - a.hits || byStart(a.item, b.item))
    .slice(0, max)
    .map((x) => x.item)
    .sort(byStart);
}

export function rankByOverlap(events: DayItem[], interests: string[]): { item: DayItem; why: string }[] {
  const wanted = interests.map((i) => i.toLowerCase());
  return events
    .map((e) => {
      const hay = [...(e.tags ?? []), e.title].join(" | ");
      const hits = wanted.filter((w) => hasPhrase(hay, w));
      return { item: e, hits };
    })
    .filter((x) => x.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length)
    .map((x) => ({ item: x.item, why: `You picked ${x.hits.slice(0, 2).join(" and ")}.` }));
}

export function defaultStudyMinutes(): number {
  return DEFAULT_STUDY_MIN;
}

const ORDINAL = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Sol's spoken briefing when Gemini is out, in the same voice: the next time to leave first, then the work due
 * soonest, then one pick. `ahead` (e.g. "Tomorrow, Mon Nov 16") makes it a look-ahead at a later day: no
 * "today", no current temperature. `nowMs` leaves out classes that already started and work already past due.
 */
export function templateBriefing(items: DayItem[], suggestions: DayItem[], weather?: Weather, ahead?: string, nowMs = 0): string {
  const parts: string[] = [];
  const bottle = weather?.isHot ? ", so fill your bottle before you go" : "";
  if (weather && ahead) parts.push(`${ahead}, high of ${Math.round(weather.highF)}°F${bottle}.`);
  else if (weather) parts.push(`It's ${Math.round(weather.tempF)}°F in Tempe now, with a high of ${Math.round(weather.highF)}°F${bottle}.`);
  else if (ahead) parts.push(`${ahead}.`);

  const day = ahead ? "that day" : "today";
  const classes = items.filter((i) => i.type === "class");
  // A shift or a study group is not a class, so a day with one counts things, not classes.
  const allCourses = classes.every((c) => isCourse(c.title));
  const first = classes.find((c) => Date.parse(c.start) > nowMs);
  if (!classes.length) {
    parts.push(`No classes ${day}.`);
  } else if (!first) {
    parts.push(allCourses ? "Your classes are done for today." : "That's everything on your list for today.");
  } else {
    const n = classes.length;
    const at = classes.indexOf(first);
    const of = allCourses ? `your ${n} classes` : `${n} things ${day}`;
    const rank = n === 1 ? "" : at === n - 1 ? `, the last of ${of}` : `, the ${ORDINAL[at] ?? "next"} of ${of}`;
    const where = !first.location ? "" : isOnline(first.location) ? " online" : ` ${isCourse(first.title) ? "in" : "at"} ${placeLabel(first.location)}`;
    const name = stopName(first);
    parts.push(
      first.leaveAt
        ? `Leave at ${clock(first.leaveAt)} for ${name}${where}${rank}.`
        : `${capitalize(name)} starts at ${clock(first.start)}${where}${rank}.`,
    );
  }

  const due = items
    .filter((i) => i.type === "deadline" && !i.done && Date.parse(i.start) > nowMs)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  if (due.length === 1) parts.push(`${capitalize(spokenAssignment(due[0].title))} is due at ${clock(due[0].start)}.`);
  else if (due.length > 1) parts.push(`${due.length} things are still open; ${spokenAssignment(due[0].title)} is due first, at ${clock(due[0].start)}.`);
  if (suggestions.length) parts.push(`I'd check out ${suggestions[0].title} at ${clock(suggestions[0].start)}.`);
  return parts.join(" ");
}
