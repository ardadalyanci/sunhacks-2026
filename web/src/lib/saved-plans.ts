// Saved day plans in MongoDB Atlas, behind a calendar the student subscribes to by URL.
// The browser makes a random calendarId once (crypto.randomUUID) and sends it with every POST /api/plan;
// each planned day is saved under it for a few days, and GET /api/plan/<id>/calendar serves them all as .ics.
// Only the plan's date, items and weather are stored: never the request, the Canvas token or the briefing.
import { buildDayIcs } from "./feeds/calendar";
import { addDays, mstDate } from "./planner";
import { dbFailed, getDb } from "./db";
import type { DayPlan } from "./types";

const KEEP_DAYS = 3; // a saved day disappears (TTL index) a few days after it happened
const MAX_DAYS = 14;

type Saved = Pick<DayPlan, "date" | "items" | "weather">;
interface PlanDoc {
  _id: string;
  calendarId: string;
  date: string;
  plan: Saved;
  updatedAt: Date;
  expiresAt: Date;
}

/** Saves one planned day. Returns false when there is no database or the write fails; the plan response never depends on it. */
export async function savePlan(calendarId: string, plan: DayPlan): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const doc: PlanDoc = {
    _id: `${calendarId}:${plan.date}`,
    calendarId,
    date: plan.date,
    plan: { date: plan.date, items: plan.items, weather: plan.weather },
    updatedAt: new Date(),
    expiresAt: new Date(`${addDays(plan.date, KEEP_DAYS)}T00:00:00-07:00`),
  };
  try {
    const { _id, ...fields } = doc;
    await db.collection<PlanDoc>("plans").replaceOne({ _id }, fields, { upsert: true });
    return true;
  } catch (err) {
    dbFailed(err);
    return false;
  }
}

/** Saved days for a calendar from yesterday on, oldest first. null when the database is unavailable. */
export async function loadPlans(calendarId: string, now = new Date()): Promise<Saved[] | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const docs = await db
      .collection<PlanDoc>("plans")
      .find({ calendarId, date: { $gte: addDays(mstDate(now), -1) } })
      .sort({ date: 1 })
      .limit(MAX_DAYS)
      .toArray();
    return docs.map((d) => d.plan);
  } catch (err) {
    dbFailed(err);
    return null;
  }
}

/** One .ics with the events of every saved day (each day built by lib/feeds/calendar.ts). */
export function calendarIcs(days: Saved[], now = new Date()): string {
  const lines = (d: Saved) =>
    buildDayIcs({ ...d, suggestions: [], briefing: "", aiUsed: false }, { calendarName: "Sundial", now }).split("\r\n").filter(Boolean);
  // Calendar header from one day (everything before its first event), then every day's VEVENT blocks.
  // Event UIDs already include the date, so days never clash.
  const first = lines(days[0] ?? { date: mstDate(now), items: [] });
  const firstEvent = first.indexOf("BEGIN:VEVENT");
  const header = first.slice(0, firstEvent === -1 ? first.indexOf("END:VCALENDAR") : firstEvent);
  const events = days.flatMap((d) => {
    const l = lines(d);
    const start = l.indexOf("BEGIN:VEVENT");
    return start === -1 ? [] : l.slice(start, l.lastIndexOf("END:VEVENT") + 1);
  });
  return [...header, ...events, "END:VCALENDAR"].join("\r\n") + "\r\n";
}
