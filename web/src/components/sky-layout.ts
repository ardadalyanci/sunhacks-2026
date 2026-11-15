// Layout math for SkyDay: which hours the sky shows, where the pins go, and the color of each hour.
// No React here, so the rules are easy to test.
import type { DayItem } from "@/lib/types";
import { parseLocal } from "./time";

export const DAY_START = 8; // the planner's working day (DAY_START and DAY_END in lib/planner.ts)
export const DAY_END = 22;
export const PIN_HEIGHT = 28; // px, matches h-7 on the pin buttons
const PIN_GAP = 4;

/** Hour of `iso` on the Arizona day `date`: 24 when it falls on a later day, 0 on an earlier one. */
export function hourOn(iso: string, date: string): number {
  const t = parseLocal(iso);
  if (t.date > date) return 24;
  if (t.date < date) return 0;
  return t.hours;
}

/**
 * The whole hours the sky shows: the planner's 8 am to 10 pm, stretched to fit anything earlier or later.
 * Deadlines stretch only the end, because 11:59 pm is a common Canvas due time; one due before the first
 * hour sits at the top edge instead of adding hours of empty sky.
 */
export function dayBounds(items: DayItem[], date: string): { first: number; last: number } {
  let first = DAY_START;
  let last = DAY_END;
  for (const item of items) {
    const start = hourOn(item.start, date);
    if (item.type !== "deadline") {
      first = Math.min(first, Math.floor(start));
      if (item.leaveAt) first = Math.min(first, Math.floor(hourOn(item.leaveAt, date)));
    }
    const end = item.end ? hourOn(item.end, date) : item.type === "deadline" ? start : start + 0.5;
    last = Math.max(last, Math.ceil(end));
  }
  return { first: Math.max(0, first), last: Math.min(24, last) };
}

/**
 * Moves pins apart so none overlap. Each pin wants to be centered on its time (`centers`, in px), pins keep
 * their order, and they stay inside the sky (0 to `height`). Returns the top of each pin, in the input order.
 */
export function stackPins(centers: number[], height: number): number[] {
  const step = PIN_HEIGHT + PIN_GAP;
  const order = centers.map((center, index) => ({ index, top: center - PIN_HEIGHT / 2 })).sort((a, b) => a.top - b.top);
  // Push each pin below the one above it...
  order.forEach((pin, k) => {
    pin.top = Math.max(pin.top, k === 0 ? 0 : order[k - 1].top + step);
  });
  // ...then pull pins that ran past the bottom of the sky back up.
  for (let k = order.length - 1; k >= 0; k--) {
    order[k].top = Math.min(order[k].top, k === order.length - 1 ? height - PIN_HEIGHT : order[k + 1].top - step);
  }
  const tops: number[] = [];
  for (const pin of order) tops[pin.index] = pin.top;
  return tops;
}

// Time of day is color. Each stop is an hour on the Arizona clock: night, sunrise, morning, noon, afternoon,
// sunset, dusk and night again. Between 8 am and 10 pm these match the .sky-day gradient in globals.css.
const SKY: [number, string][] = [
  [5, "#2b2766"],
  [6.5, "#f9d9bd"],
  [8, "#eef6ff"],
  [12, "#d4e8ff"],
  [16, "#ffe9bd"],
  [18, "#ffcf8f"],
  [19.5, "#9b86d6"],
  [22, "#2b2766"],
];

// The midday heat glowing through the sky on hot days (matches .sky-day-hot).
const HEAT: [number, string][] = [
  [10.5, "rgb(255 110 50 / 0)"],
  [13.3, "rgb(255 110 50 / 0.38)"],
  [16.7, "rgb(255 110 50 / 0.38)"],
  [18.6, "rgb(255 110 50 / 0)"],
];

/** True for hours where the sky is dark, so labels on it need light text. */
export const isDarkHour = (hour: number) => hour <= 5 || hour >= 19;

/** CSS background for a sky whose hour `h` is `y(h)` px from the top, so each hour gets its own color. */
export function skyBackground(y: (hour: number) => number, hot: boolean): string {
  const gradient = (stops: [number, string][]) =>
    `linear-gradient(to bottom, ${stops.map(([hour, color]) => `${color} ${Math.round(y(hour))}px`).join(", ")})`;
  return hot ? `${gradient(HEAT)}, ${gradient(SKY)}` : gradient(SKY);
}
