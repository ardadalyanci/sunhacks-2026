// Layout math for SkyDay: which hours the sky shows, where the pins go, and the color of each hour.
// No React here, so the rules are easy to test.
import type { DayItem } from "@/lib/types";
import { formatTime, parseLocal } from "./time";

export const DAY_START = 8; // the planner's working day starts here (DAY_START in lib/planner.ts)
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
 * The whole hours the sky shows. It starts at 8 am, or earlier for an early class and its walk. It ends an
 * hour after the later of the last block and the sunset, rounded up, so an empty evening is not drawn; on a
 * real today it also reaches the current hour, so Sol's "now" stays on the sky. Deadlines never stretch it:
 * one due before the first hour or after the last sits as a pin at that edge, with its real time.
 */
export function dayBounds(items: DayItem[], date: string, sun: Sun, nowHour?: number): { first: number; last: number } {
  let first = DAY_START;
  let end = sun.sunset;
  for (const item of items) {
    if (item.type === "deadline") continue;
    const start = hourOn(item.start, date);
    first = Math.min(first, Math.floor(start));
    if (item.leaveAt) first = Math.min(first, Math.floor(hourOn(item.leaveAt, date)));
    end = Math.max(end, item.end ? hourOn(item.end, date) : start + 0.5);
  }
  let last = Math.ceil(end + 1);
  if (nowHour !== undefined && nowHour >= first) last = Math.max(last, Math.ceil(nowHour));
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

/** "Lab 7" from "CSE 230: Lab 7 (pipelining)", "HW 9" from "MAT 343: Homework 9": short enough for a pin. */
export function assignmentName(title: string): string {
  const name = title
    .replace(/^[A-Z]{2,4} \d{3}[A-Z]?:\s*/, "")
    .replace(/\s*\([^)]*\)/g, "")
    .trim();
  return (name || title).replace(/^Homework\b/i, "HW");
}

/** "Work on Lab 7 · CSE 230" from the planner's "Work on: CSE 230: Lab 7 (pipelining)"; other titles stay. */
export function blockTitle(title: string): string {
  const m = /^Work on: ([A-Z]{2,4} \d{3}[A-Z]?): (.+)$/.exec(title);
  return m ? `Work on ${assignmentName(m[2])} · ${m[1]}` : title;
}

/** "10:30–11:20 am", "11:30 am–12:20 pm": a block's time, with am/pm written once when it can be. */
export function rangeLabel(start: number, end: number): string {
  const a = formatTime(start);
  const b = formatTime(end);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
}

// A block's px range in the sky, and `pad`: the px at its top and bottom where no text sits (a block's text is
// centered in it, so a tall work shift has a lot).
export type Box = { id: string; top: number; bottom: number; pad?: number };

/**
 * True when a pin centered at `center` would cover a block other than `ownId`, for example the short study
 * block that often ends right where a leave pin sits. A few px of touching do not count.
 */
export function coversOtherBlock(center: number, boxes: Box[], ownId: string): boolean {
  const top = center - PIN_HEIGHT / 2;
  const bottom = center + PIN_HEIGHT / 2;
  return boxes.some((b) => b.id !== ownId && Math.min(bottom, b.bottom) - Math.max(top, b.top) > 4);
}

export type PinSpot = { top: number; lane: boolean };

/**
 * Where each pin goes: stacked so none overlap (see stackPins), then any pin that lands on a block's text moves
 * into the lane at the right edge with its short label. A pin may sit on its own block's edge (a leave pin just
 * above its class), but not once stacking has pushed it away from its time and onto that block.
 */
export function layoutPins(pins: { center: number; ownId: string }[], height: number, boxes: Box[]): PinSpot[] {
  const tops = stackPins(
    pins.map((p) => p.center),
    height,
  );
  return pins.map((pin, k) => {
    const moved = Math.abs(tops[k] + PIN_HEIGHT / 2 - pin.center) > 1;
    return { top: tops[k], lane: coversOtherBlock(tops[k] + PIN_HEIGHT / 2, boxes, moved ? "" : pin.ownId) };
  });
}

/**
 * The blocks that share their height with a lane pin: they narrow, so the pin sits beside their text. A pin that
 * only reaches into a block's padding (`pad`, 8 px when not given) leaves it wide, like the long work shift whose
 * centered text is far from the "Leave 1:27 pm" pin on its top edge.
 */
export function narrowedBlocks(spots: PinSpot[], boxes: Box[]): Set<string> {
  const reach = (spot: PinSpot, b: Box) => Math.min(spot.top + PIN_HEIGHT, b.bottom) - Math.max(spot.top, b.top);
  return new Set(spots.flatMap((spot) => (spot.lane ? boxes.filter((b) => reach(spot, b) > (b.pad ?? 8)).map((b) => b.id) : [])));
}

const CAPTION_HEIGHT = 28; // px, Sol's caption bubble (py-1 around 13 px text)

/**
 * Where Sol's caption goes so it keeps clear of the pins: above his line, else below it, else the same on the
 * right side of the sky. Above needs room under the sky's top edge. `pins` are the drawn pins' tops and sides.
 * With `blocks` (Sol at rest, where the caption stays put), a left spot must also keep clear of the blocks,
 * whose text starts on the left; the right side of a block is usually empty.
 */
export function captionSpot(
  solY: number,
  pins: { top: number; right: boolean }[],
  height: number,
  blocks: Box[] = [],
): { below: boolean; right: boolean } {
  const span = (below: boolean): [number, number] => (below ? [solY + 6, solY + 6 + CAPTION_HEIGHT] : [solY - 4 - CAPTION_HEIGHT, solY - 4]);
  const fits = (below: boolean) => (below ? solY + 6 + CAPTION_HEIGHT <= height : solY >= 44);
  const options = [
    { below: false, right: false },
    { below: true, right: false },
    { below: false, right: true },
    { below: true, right: true },
  ].filter((o) => fits(o.below));
  const clear = options.find((o) => {
    const [a, b] = span(o.below);
    const onPin = pins.some((p) => p.right === o.right && Math.min(b, p.top + PIN_HEIGHT) - Math.max(a, p.top) > 0);
    const onText = !o.right && blocks.some((x) => Math.min(b, x.bottom) - Math.max(a, x.top) > 4);
    return !onPin && !onText;
  });
  return clear ?? options[0] ?? { below: solY < 44, right: false };
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

export type Sun = { sunrise: number; sunset: number }; // Arizona clock hours, e.g. 6.98 and 17.4

/**
 * Sunrise and sunset in Tempe (33.42° N, 111.93° W) on `date`, in Arizona hours (UTC-7 all year).
 * NOAA's solar equations; good to a couple of minutes, which is all a sky needs.
 */
export function sunTimes(date: string): Sun {
  const rad = Math.PI / 180;
  const lat = 33.42;
  const lng = -111.93;
  const noon = Date.parse(`${date}T12:00:00Z`);
  const dayOfYear = Math.floor((noon - Date.UTC(new Date(noon).getUTCFullYear(), 0, 0)) / 86_400_000);
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1); // fractional year at noon
  const eqTime =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const hourAngle =
    Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl)) / rad;
  const local = (utcMinutes: number) => (utcMinutes / 60 - 7 + 24) % 24;
  return { sunrise: local(720 - 4 * (lng + hourAngle) - eqTime), sunset: local(720 - 4 * (lng - hourAngle) - eqTime) };
}

/** The sky's colors pinned to the real sun: peach at sunrise, gold before sunset, purple after, then night. */
export function skyStops({ sunrise, sunset }: Sun): [number, string][] {
  return [
    [sunrise - 1.5, "#2b2766"],
    [sunrise, "#f9d9bd"],
    [sunrise + 1.5, "#eef6ff"],
    [(sunrise + sunset) / 2, "#d4e8ff"],
    [sunset - 1.5, "#ffe9bd"],
    [sunset, "#ffcf8f"],
    [sunset + 0.75, "#9b86d6"],
    [sunset + 2.25, "#2b2766"],
  ];
}

/** True for hours where the sky is dark, so labels on it need light text. */
export const isDarkHour = (hour: number, sun?: Sun) =>
  sun ? hour <= sun.sunrise - 0.75 || hour >= sun.sunset + 1 : hour <= 5 || hour >= 19;

/** CSS background for a sky whose hour `h` is `y(h)` px from the top, so each hour gets its own color. */
export function skyBackground(y: (hour: number) => number, hot: boolean, sun?: Sun): string {
  const gradient = (stops: [number, string][]) =>
    `linear-gradient(to bottom, ${stops.map(([hour, color]) => `${color} ${Math.round(y(hour))}px`).join(", ")})`;
  const sky = sun ? skyStops(sun) : SKY;
  return hot ? `${gradient(HEAT)}, ${gradient(sky)}` : gradient(sky);
}

export type Stop = { hour: number; text: string; mood?: "proud" };

/** The moments "Play my day" stops on: each walk, study block, deadline, and the sunset. */
export function dayStops(items: DayItem[], date: string, sun: Sun, place: (location?: string) => string): Stop[] {
  const stops: Stop[] = [];
  for (const i of items) {
    if (i.leaveAt && (i.type === "class" || i.type === "event")) {
      stops.push({ hour: hourOn(i.leaveAt, date), text: `Leave now for ${place(i.location) || i.title}` });
    }
    if (i.type === "study_block") stops.push({ hour: hourOn(i.start, date), text: `Time for ${blockTitle(i.title).replace(/^Work on /, "")}` });
    if (i.type === "deadline") {
      const name = assignmentName(i.title);
      stops.push(i.done ? { hour: hourOn(i.start, date), text: `${name}: turned in`, mood: "proud" } : { hour: hourOn(i.start, date), text: `${name} is due` });
    }
  }
  stops.push({ hour: sun.sunset, text: `Sunset, ${formatTime(sun.sunset)}` });
  return stops.sort((a, b) => a.hour - b.hour);
}

/** The stop to show at `hour`: the last one reached in the past `holdHours`, or none. */
export function stopAt(stops: Stop[], hour: number, holdHours = 0.6): Stop | undefined {
  let found: Stop | undefined;
  for (const s of stops) if (s.hour <= hour && hour - s.hour <= holdHours) found = s;
  return found;
}
