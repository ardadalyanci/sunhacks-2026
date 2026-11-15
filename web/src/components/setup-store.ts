// What the setup screen saves in the browser. Nothing here is sent to our server except per request.
import type { ClassBlock, DayItem } from "@/lib/types";

export interface SavedSetup {
  name: string;
  classes: ClassBlock[];
  interests: string[];
  startBuildingId?: string;
  pace?: "slower"; // "Give me more time to walk": every leave time is earlier, and earlier again in heat
}

// The keys keep the working name (DayPilot), so setups saved before the rename to Sundial still load.
const SETUP_KEY = "daypilot.setup";
const TOKEN_KEY = "daypilot.canvasToken"; // sessionStorage: gone when the tab closes
const CALENDAR_KEY = "daypilot.calendarId"; // names this browser's calendar feed (GET /api/plan/<id>/calendar)

/**
 * The id of this browser's calendar feed: a random UUID made once and kept. /api/plan saves each planned day
 * under it (MongoDB), and the feed URL is what the student subscribes to. Undefined when storage is blocked.
 */
export function loadCalendarId(): string | undefined {
  try {
    let id = localStorage.getItem(CALENDAR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CALENDAR_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

export function loadSetup(): SavedSetup | null {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return null;
    const setup = JSON.parse(raw) as SavedSetup;
    return Array.isArray(setup.classes) && setup.classes.length > 0 ? setup : null;
  } catch {
    return null;
  }
}

export function saveSetup(setup: SavedSetup, token: string) {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked (private mode): the sample day still works
  }
}

export function clearSetup() {
  try {
    localStorage.removeItem(SETUP_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // nothing to clear
  }
}

// Events the student added, per day ({ "2026-11-14": [ids] }), shared by Today and Events. Per day because the
// sample day reuses its event ids every day: adding Robotics today must not add it tomorrow.
const ACCEPTED_KEY = "daypilot.accepted";

function readAccepted(): Record<string, string[]> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(ACCEPTED_KEY) ?? "{}") as unknown;
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {}; // the older single list: start fresh
    const days: Record<string, string[]> = {};
    for (const [date, ids] of Object.entries(saved)) {
      if (Array.isArray(ids)) days[date] = ids.filter((x): x is string => typeof x === "string");
    }
    return days;
  } catch {
    return {};
  }
}

/** Events the student added to the day `date`. */
export function loadAccepted(date: string): string[] {
  return readAccepted()[date] ?? [];
}

export function saveAccepted(date: string, ids: string[]) {
  try {
    sessionStorage.setItem(ACCEPTED_KEY, JSON.stringify({ ...readAccepted(), [date]: ids }));
  } catch {
    // storage blocked: the choice lasts until the page reloads
  }
}

const HIDDEN_KEY = "daypilot.hidden"; // timeline items the student removed: { "2026-11-14": [keys] }
const HIDDEN_DAYS = 14; // days remembered; older ones are dropped

/**
 * Stable name for a timeline item. Planner ids such as study-block numbers can shift when the day is planned
 * again, so removed items are remembered by what they are and when they happen.
 */
export function itemKey(item: DayItem): string {
  return [item.type, item.title, item.start, item.end ?? ""].join("|");
}

function readHidden(): Record<string, string[]> {
  try {
    const saved = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "{}") as unknown;
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    const days: Record<string, string[]> = {};
    for (const [date, keys] of Object.entries(saved)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(keys)) {
        days[date] = keys.filter((x): x is string => typeof x === "string");
      }
    }
    return days;
  } catch {
    return {};
  }
}

/** Keys (see itemKey) of the items the student removed from the day `date`. */
export function loadHidden(date: string): string[] {
  return readHidden()[date] ?? [];
}

export function saveHidden(date: string, keys: string[]) {
  const days = { ...readHidden(), [date]: keys };
  const kept = Object.keys(days).sort().slice(-HIDDEN_DAYS);
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(Object.fromEntries(kept.map((d) => [d, days[d]]))));
  } catch {
    // storage blocked: the removal lasts until the page reloads
  }
}

/** Removes the Canvas token from this tab (the "Forget my token" button). */
export function forgetToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked: nothing was saved
  }
}

export function loadToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
