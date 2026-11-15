// Converts between the public UI contract (./types.ts, designed by B) and the planning engine's own
// types (./engine-types.ts). Screens only ever see the public shapes. Pure functions, no I/O.
import type * as E from "./engine-types";
import { clock, mstDate, rankByOverlap } from "./planner";
import type * as UI from "./types";

const HOT_FEELS_LIKE_F = 95;

// ---------- UI → engine ----------

/** Setup classes ({ building: "BYENG", room: "210" }) → engine classes ({ location: "BYENG 210" }). */
export function engineClasses(classes: UI.ClassBlock[]): E.ClassBlock[] {
  return classes.map((c) => ({
    course: c.course,
    days: c.days,
    start: c.start,
    end: c.end,
    location: [c.building, c.room].filter(Boolean).join(" ") || undefined,
  }));
}

export function engineOpportunity(e: UI.CampusEvent): E.Opportunity {
  return {
    id: e.id,
    kind: "club_event",
    title: e.title,
    organizer: "",
    description: e.description ?? "",
    url: e.url,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    location: e.location,
    tags: e.interests,
    source: e.source === "sun_devil_central" ? "sundevilcentral" : "asu_events",
    fetchedAt: e.startsAt,
  };
}

/**
 * Hourly feels-like weather → the engine's simple { tempF, highF, isHot }.
 * tempF is the feels-like at the hour closest to `now` (the briefing says "It's X degrees"); highF and isHot
 * use the hottest daytime hour, so the high is never below the current temperature.
 */
export function engineWeather(w: UI.Weather | undefined, now?: string): E.Weather | undefined {
  if (!w) return undefined;
  const daytime = w.hourly.filter((h) => {
    const hour = Number(h.time.slice(11, 13));
    return hour >= 8 && hour <= 20;
  });
  const peak = Math.max(...(daytime.length ? daytime : w.hourly).map((h) => h.feelsLikeF), w.highF);
  const nowMs = now ? Date.parse(now) : NaN;
  const current = Number.isNaN(nowMs)
    ? undefined
    : w.hourly.reduce<UI.Weather["hourly"][number] | undefined>(
        (best, h) => (!best || Math.abs(Date.parse(h.time) - nowMs) < Math.abs(Date.parse(best.time) - nowMs) ? h : best),
        undefined,
      );
  const tempF = current?.feelsLikeF ?? peak;
  return { tempF, highF: Math.max(peak, tempF), isHot: peak >= HOT_FEELS_LIKE_F };
}

// ---------- engine → UI ----------

/** "CSE 230: Lab 7" → { course: "CSE 230", title: "Lab 7" }. */
function splitCourse(title: string): { course?: string; title: string } {
  const m = title.match(/^([A-Z]{2,4} \d{3}[A-Z]?): (.+)$/);
  return m ? { course: m[1], title: m[2] } : { title };
}

const minutesBetween = (a?: string, b?: string) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 60_000) : undefined);

/** The engine's id for an event item is "ev-<event id>"; the UI uses "event-<event id>" for timeline items. */
const eventItemId = (engineId: string) => `event-${engineId.replace(/^ev-/, "")}`;

/** One engine timeline item → one or two UI items (a "leave" marker goes before anything you walk to). */
function uiItem(item: E.DayItem): UI.DayItem[] {
  switch (item.type) {
    case "class": {
      const building = item.buildingId ?? item.location?.split(" ")[0];
      const cls: UI.DayItem = { id: item.id, kind: "class", title: item.title, course: item.title, startsAt: item.start, endsAt: item.end, building, location: item.location };
      return [...leaveMarker(item, cls.id, building), cls];
    }
    case "event": {
      const ev: UI.DayItem = { id: eventItemId(item.id), kind: "event", title: item.title, startsAt: item.start, endsAt: item.end, building: item.buildingId, location: item.location, url: item.url };
      return [...leaveMarker(item, ev.id, item.buildingId ?? item.location), ev];
    }
    case "deadline": {
      const { course, title } = splitCourse(item.title);
      return [{ id: item.id, kind: "assignment", title, course, dueAt: item.start, submitted: Boolean(item.done), estimatedMinutes: item.done ? undefined : item.estimatedMinutes, url: item.url }];
    }
    case "study_block": {
      const { course, title } = splitCourse(item.title.replace(/^Work on: /, ""));
      return [{ id: item.id, kind: "study", title: `Work on ${title}`, course, startsAt: item.start, endsAt: item.end, estimatedMinutes: minutesBetween(item.start, item.end), forItemId: item.forItemId, url: item.url }];
    }
    default:
      return [];
  }
}

function leaveMarker(item: E.DayItem, forId: string, place?: string): UI.DayItem[] {
  if (!item.leaveAt) return [];
  return [{ id: `leave-${forId}`, kind: "leave", title: `Leave for ${place ?? item.title}`, startsAt: item.leaveAt, walkMinutes: minutesBetween(item.leaveAt, item.start), forItemId: forId }];
}

const timeOf = (i: UI.DayItem) => i.startsAt ?? i.dueAt ?? "";

/** The engine plan's timeline in UI items, sorted by time (leave markers sit right before their stop). */
export function uiItems(plan: E.DayPlan): UI.DayItem[] {
  return plan.items.flatMap(uiItem).sort((a, b) => timeOf(a).localeCompare(timeOf(b)));
}

/** Assignments due after `date` (tomorrow and later), soonest first. */
export function uiDueSoon(deadlines: E.DayItem[], date: string): UI.DayItem[] {
  return deadlines
    .filter((d) => mstDate(new Date(d.start)) > date)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .flatMap(uiItem);
}

export function uiEvent(item: E.DayItem): UI.CampusEvent {
  return {
    id: item.id.replace(/^ev-/, ""),
    title: item.title,
    startsAt: item.start,
    endsAt: item.end,
    location: item.location,
    url: item.url ?? "",
    source: item.source === "sundevilcentral" ? "sun_devil_central" : "asu_events",
    interests: item.tags ?? [],
  };
}

/**
 * Event picks for the Events and Today screens: today's suggestions from the planner first (they fit the
 * schedule), then events on the next 6 days that match the student's interests. Scores only order them.
 */
export function uiPicks(suggestions: E.DayItem[], laterEvents: E.DayItem[], interests: string[], max = 12): UI.EventPick[] {
  const today = suggestions.map((s, i) => ({ event: uiEvent(s), score: round(0.95 - i * 0.04), why: s.why ?? "" }));
  const later = rankByOverlap(laterEvents, interests).map(({ item, why }, i) => ({ event: uiEvent(item), score: round(0.75 - i * 0.03), why }));
  return [...today, ...later].slice(0, max);
}
const round = (n: number) => Math.max(0.05, Math.round(n * 100) / 100);

/** The hottest walk of the day, if its feels-like temperature reaches 95 °F. */
export function heatAlert(items: UI.DayItem[], weather: UI.Weather | undefined): UI.HeatAlert | undefined {
  if (!weather?.hourly.length) return undefined;
  let worst: { leave: UI.DayItem; feels: number } | undefined;
  for (const leave of items.filter((i) => i.kind === "leave" && i.startsAt)) {
    const feels = feelsLikeAt(weather, leave.startsAt!);
    if (!worst || feels > worst.feels) worst = { leave, feels };
  }
  if (!worst || worst.feels < HOT_FEELS_LIKE_F) return undefined;
  const place = worst.leave.title.replace(/^Leave for /, "");
  return {
    at: worst.leave.startsAt!,
    feelsLikeF: Math.round(worst.feels),
    message: `Feels like ${Math.round(worst.feels)}°F when you walk to ${place} at ${clock(worst.leave.startsAt!)}. Take water, and check Cool Routes for a shaded path.`,
  };
}

/** Feels-like °F of the hourly entry closest to `iso`. */
function feelsLikeAt(w: UI.Weather, iso: string): number {
  const t = Date.parse(iso);
  return w.hourly.reduce((best, h) => (Math.abs(Date.parse(h.time) - t) < Math.abs(Date.parse(best.time) - t) ? h : best)).feelsLikeF;
}

