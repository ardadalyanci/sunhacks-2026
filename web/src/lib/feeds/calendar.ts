// Turns a planned day (DayPlan from POST /api/plan) into an .ics file that Google or Apple Calendar can import.
// Classes, study blocks and events become timed events; open deadlines become a short "Due" block that ends at
// the deadline; every item with a `leaveAt` gets a reminder at that time, so the phone buzzes when it is time to
// walk. Pure functions, no I/O.
import { escapeText, foldLine, icsUtc } from "./ical";
import type { DayItem, DayPlan } from "../types";

const MIN = 60_000;

export interface IcsOptions {
  calendarName?: string;
  now?: Date; // DTSTAMP; defaults to the current time
}

const prop = (name: string, value: string) => `${name}:${escapeText(value)}`;

/** "1:12 PM" in Arizona time. */
function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" });
}

function vevent(item: DayItem, plan: DayPlan, stamp: string): string[] {
  const start = new Date(item.start);
  if (Number.isNaN(start.getTime())) return [];
  const isDue = item.type === "deadline";
  let begin = start;
  let end = item.end ? new Date(item.end) : new Date(start.getTime() + 30 * MIN);
  if (isDue) {
    begin = new Date(start.getTime() - 15 * MIN); // a 15-minute block that ends at the deadline
    end = start;
  }
  if (!(end > begin)) end = new Date(begin.getTime() + 30 * MIN);

  const title = isDue ? `Due: ${item.title}` : item.title;
  const location = item.location ?? item.buildingId;
  const leave = item.leaveAt && !Number.isNaN(Date.parse(item.leaveAt)) ? item.leaveAt : undefined;

  const notes: string[] = [];
  if (leave) notes.push(`Leave at ${clock(leave)} (${Math.max(1, Math.round((start.getTime() - Date.parse(leave)) / MIN))} min walk).`);
  if (leave && plan.weather?.isHot) notes.push(`Hot day (high ${Math.round(plan.weather.highF)}°F): take water and pick a shaded path.`);
  if (item.why) notes.push(item.why);
  if (item.url) notes.push(item.url);
  notes.push("Planned by Sundial.");

  const out = [
    "BEGIN:VEVENT",
    `UID:${item.id.replace(/[^A-Za-z0-9._-]/g, "-")}-${plan.date}@sundial`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsUtc(begin)}`,
    `DTEND:${icsUtc(end)}`,
    prop("SUMMARY", title),
    ...(location ? [prop("LOCATION", location)] : []),
    prop("DESCRIPTION", notes.join("\n")),
    ...(item.url ? [`URL:${item.url}`] : []),
    `CATEGORIES:${item.type.toUpperCase()}`,
    isDue || item.type === "study_block" ? "TRANSP:TRANSPARENT" : "TRANSP:OPAQUE",
  ];
  if (leave) {
    out.push("BEGIN:VALARM", "ACTION:DISPLAY", prop("DESCRIPTION", `Leave now for ${location ?? title}`), `TRIGGER;VALUE=DATE-TIME:${icsUtc(new Date(leave))}`, "END:VALARM");
  } else if (isDue) {
    out.push("BEGIN:VALARM", "ACTION:DISPLAY", prop("DESCRIPTION", title), "TRIGGER:-PT2H", "END:VALARM");
  }
  out.push("END:VEVENT");
  return out;
}

/** The planned day as an iCalendar string (CRLF line endings, folded at 75 octets). Submitted work and travel rows are left out. */
export function buildDayIcs(plan: DayPlan, options: IcsOptions = {}): string {
  const stamp = icsUtc(options.now ?? new Date());
  const body = plan.items.filter((i) => i.type !== "travel" && !(i.type === "deadline" && i.done)).flatMap((i) => vevent(i, plan, stamp));
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Sundial//Day plan//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      prop("X-WR-CALNAME", options.calendarName ?? "Sundial"),
      "X-WR-TIMEZONE:America/Phoenix",
      ...body,
      "END:VCALENDAR",
    ]
      .map(foldLine)
      .join("\r\n") + "\r\n"
  );
}
