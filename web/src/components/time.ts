import type { Weekday } from "@/lib/types";

export const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Parses "2026-11-18T18:30:00-07:00" as Arizona local time, independent of the viewer's time zone. */
export function parseLocal(iso: string) {
  const [date, rest = "00:00"] = iso.split("T");
  const hours = Number(rest.slice(0, 2)) + Number(rest.slice(3, 5)) / 60;
  const jsDay = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const dayIndex = (jsDay + 6) % 7; // 0 = Monday
  return { date, hours, dayIndex };
}

export function hhmmToHours(hhmm: string) {
  return Number(hhmm.slice(0, 2)) + Number(hhmm.slice(3, 5)) / 60;
}

/** "1:30 pm" for 13.5; 24 is midnight ("12 am"). Rounds to the minute, so 9.9999 is "10 am", not "9:60 am". */
export function formatTime(hours: number) {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatRange(startIso: string, endIso: string) {
  return `${formatTime(parseLocal(startIso).hours)} to ${formatTime(parseLocal(endIso).hours)}`;
}

/** "Wednesday, Nov 18" */
export function formatDay(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Seven ISO dates starting from `first` ("2026-11-14" → the 14th to the 20th). */
export function weekDates(first: string) {
  const start = new Date(`${first}T12:00:00Z`).getTime();
  return Array.from({ length: 7 }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  );
}

/** Today's date in Arizona ("2026-11-14"). Arizona has no daylight saving, so it is always UTC-7. */
export function arizonaToday(nowMs = Date.now()) {
  return new Date(nowMs - 7 * 3_600_000).toISOString().slice(0, 10);
}

/** "Mon 16" for the day picker. */
export function shortDay(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${weekday} ${Number(date.slice(8, 10))}`;
}
