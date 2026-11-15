// The walk the Today screen leads with. No React here. Building names come from lib/places (shared with the
// server, which uses them in Sol's briefing).
import type { DayItem } from "@/lib/types";

export { findPlace, placeLabel, walkLink } from "@/lib/places";

export type Walk = { item: DayItem; leaveMs: number; minutes: number; now: boolean };

/**
 * The next walk at `nowMs`: the first class or event with a leave time that has not started yet.
 * `now` is true between its leave time and its start ("Leave now").
 */
export function nextWalk(items: DayItem[], nowMs: number): Walk | null {
  const item = items
    .filter((i) => (i.type === "class" || i.type === "event") && i.leaveAt && Date.parse(i.start) > nowMs)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  if (!item?.leaveAt) return null;
  const leaveMs = Date.parse(item.leaveAt);
  return {
    item,
    leaveMs,
    minutes: Math.max(1, Math.round((Date.parse(item.start) - leaveMs) / 60_000)),
    now: leaveMs <= nowMs,
  };
}

/** "2 h 13 min", "23 min", "1 h": how long until a moment. */
export function untilText(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Fahrenheit to Celsius, rounded, for students who think in °C. */
export const toCelsius = (f: number) => Math.round(((f - 32) * 5) / 9);
