// Map math for WalkMap: which walks the day has, where each building lands on the map, which OpenStreetMap
// tiles sit under it and where the labels go. No React here, so the rules are easy to test.
// Tiles and dots both use Web Mercator (the projection OpenStreetMap tiles are drawn in), so they line up.
import type { DayItem } from "@/lib/types";
import { buildingWord, findPlace } from "@/lib/places";
import { parseLocal } from "./time";

export type Place = { id: string; word: string; lat: number; lng: number };
/** One stop of the day in visit order (1 is where the day starts). */
export type Stop = { number: number; place: Place; itemIds: string[] };
/** One walk: from the stop before to the item's building, with the minutes the plan gave it. */
export type Leg = {
  itemId: string;
  title: string;
  location?: string;
  from: Place;
  to: Place;
  toNumber: number;
  minutes: number;
  leaveAt: string;
  start: string;
};
export type Bounds = { south: number; north: number; west: number; east: number };
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type Box = { x: number; y: number; width: number; height: number };

const MIN_SPAN_M = 500; // never closer than this across, so a one-building day still shows the campus around it
const PAD = 0.12; // share of the span added on each side, so dots never sit on the edge
const M_PER_DEG_LAT = 111_320;
export const MARGIN = 30; // map units kept free around the stops for dots and labels

function placeOf(ref: string | undefined): Place | undefined {
  const { building } = findPlace(ref);
  return building && { id: building.id, word: buildingWord(building), lat: building.lat, lng: building.lng };
}

/**
 * The day's stops and walks. Stops are where the day starts (when `startBuildingId` matches a building) and
 * then every class or event on `date` with a leave time at a known building, in time order. Two stops in a row
 * at the same building are one stop, and no walk joins them. Minutes come from the plan (start minus leaveAt),
 * so the map always agrees with the leave times; an item at an unknown place is skipped, as the planner does.
 */
export function walkLegs(items: DayItem[], date: string, startBuildingId?: string): { stops: Stop[]; legs: Leg[] } {
  const stops: Stop[] = [];
  const legs: Leg[] = [];
  const start = placeOf(startBuildingId);
  if (start) stops.push({ number: 1, place: start, itemIds: [] });
  const walks = items
    .filter((i) => (i.type === "class" || i.type === "event") && i.leaveAt && parseLocal(i.start).date === date)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  for (const item of walks) {
    const place = placeOf(item.buildingId ?? item.location);
    if (!place) continue;
    const last = stops.at(-1);
    if (last && last.place.id === place.id) {
      last.itemIds.push(item.id);
      continue;
    }
    const stop = { number: stops.length + 1, place, itemIds: [item.id] };
    stops.push(stop);
    if (!last) continue; // the first stop of a day with no start building: nothing to walk from
    if (item.via) continue; // a shuttle ride or the trip from home: a stop on the map, but not a walk
    legs.push({
      itemId: item.id,
      title: item.title,
      location: item.location,
      from: last.place,
      to: place,
      toNumber: stop.number,
      minutes: Math.max(1, Math.round((Date.parse(item.start) - Date.parse(item.leaveAt!)) / 60_000)),
      leaveAt: item.leaveAt!,
      start: item.start,
    });
  }
  return { stops, legs };
}

/** "3 walks, 41 minutes on foot", plus a note when the plan added minutes for the heat. */
export function walkSummary(legs: Leg[], hot: boolean): string {
  const minutes = legs.reduce((sum, leg) => sum + leg.minutes, 0);
  const line = `${legs.length} walk${legs.length === 1 ? "" : "s"}, ${minutes} minute${minutes === 1 ? "" : "s"} on foot`;
  return hot ? `${line}, with extra minutes for the heat.` : `${line}.`;
}

/** Each building once, with every visit number ("Brickyard" is stops 2 and 4 on a Monday). */
export function markers(stops: Stop[]): { place: Place; numbers: number[] }[] {
  const byId = new Map<string, { place: Place; numbers: number[] }>();
  for (const stop of stops) {
    const marker = byId.get(stop.place.id) ?? { place: stop.place, numbers: [] };
    marker.numbers.push(stop.number);
    byId.set(stop.place.id, marker);
  }
  return [...byId.values()];
}

/** The area that holds every stop, padded, and at least MIN_SPAN_M across both ways. */
export function fitBounds(stops: Pick<Stop, "place">[]): Bounds {
  const lats = stops.map((s) => s.place.lat);
  const lngs = stops.map((s) => s.place.lng);
  let south = Math.min(...lats);
  let north = Math.max(...lats);
  let west = Math.min(...lngs);
  let east = Math.max(...lngs);
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((((south + north) / 2) * Math.PI) / 180);
  const minLat = MIN_SPAN_M / M_PER_DEG_LAT;
  const minLng = MIN_SPAN_M / mPerDegLng;
  const latPad = Math.max((north - south) * PAD, (minLat - (north - south)) / 2, 0);
  const lngPad = Math.max((east - west) * PAD, (minLng - (east - west)) / 2, 0);
  south -= latPad;
  north += latPad;
  west -= lngPad;
  east += lngPad;
  return { south, north, west, east };
}

/** Web Mercator "world" coordinates: 0 to 1 across the whole map, y growing southward. */
export function toWorld(lat: number, lng: number): Point {
  const rad = (lat * Math.PI) / 180;
  return { x: (lng + 180) / 360, y: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 };
}

/** The bounds fitted inside `size` (minus MARGIN), centered: world center and map units per world unit. */
function view(bounds: Bounds, size: Size) {
  const nw = toWorld(bounds.north, bounds.west);
  const se = toWorld(bounds.south, bounds.east);
  const scale = Math.min((size.width - 2 * MARGIN) / (se.x - nw.x), (size.height - 2 * MARGIN) / (se.y - nw.y));
  return { cx: (nw.x + se.x) / 2, cy: (nw.y + se.y) / 2, scale };
}

/** Where a building lands on the map, in the SVG's units. */
export function project(lat: number, lng: number, bounds: Bounds, size: Size): Point {
  const v = view(bounds, size);
  const w = toWorld(lat, lng);
  return { x: (w.x - v.cx) * v.scale + size.width / 2, y: (w.y - v.cy) * v.scale + size.height / 2 };
}

/**
 * The OpenStreetMap tiles under the map: the zoom whose tiles come closest to their natural 256 px, and each
 * tile's place and size in map units (between about 181 and 362, so at most 3 by 3 tiles on a 340 by 250 map).
 */
export function tilesFor(bounds: Bounds, size: Size) {
  const v = view(bounds, size);
  const z = Math.min(19, Math.max(0, Math.round(Math.log2(v.scale / 256))));
  const n = 2 ** z;
  const tileSize = v.scale / n;
  const left = v.cx - size.width / 2 / v.scale;
  const top = v.cy - size.height / 2 / v.scale;
  const right = v.cx + size.width / 2 / v.scale;
  const bottom = v.cy + size.height / 2 / v.scale;
  const tiles: { x: number; y: number; left: number; top: number; size: number }[] = [];
  for (let y = Math.floor(top * n); y < bottom * n; y++) {
    for (let x = Math.floor(left * n); x < right * n; x++) {
      tiles.push({ x, y, left: (x / n - v.cx) * v.scale + size.width / 2, top: (y / n - v.cy) * v.scale + size.height / 2, size: tileSize });
    }
  }
  return { z, tiles };
}

/**
 * A walk as a gentle curve bending to the right of the way you walk, so going A to B and back again draws two
 * lines instead of one. Returns the SVG path, where its minutes go (the curve's middle) and an arrow near its end.
 */
export function legCurve(a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const bend = Math.max(length * 0.22, 26);
  // Right of travel in SVG coordinates (y down) is (-dy, dx) normalized.
  const c = { x: (a.x + b.x) / 2 - (dy / length) * bend, y: (a.y + b.y) / 2 + (dx / length) * bend };
  const at = (t: number) => ({
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
  });
  const t = 0.78;
  const tangent = { x: 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x), y: 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y) };
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    d: `M${r(a.x)} ${r(a.y)} Q${r(c.x)} ${r(c.y)} ${r(b.x)} ${r(b.y)}`,
    mid: at(0.5),
    arrow: { ...at(t), angle: (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI },
  };
}

/** Rough width of a bold 12 px label; close enough to keep labels apart. */
export const labelWidth = (text: string) => text.length * 7 + 6;
export const LABEL_HEIGHT = 16;

export type LabelSpot = { x: number; y: number; anchor: "start" | "middle" | "end"; box: Box };

/**
 * Where each building's name goes: right, left, above or below its dot, whichever overlaps the other dots,
 * the minute pills, the labels already placed and the map's edge the least. Close buildings (Brickyard and
 * PSF) end up on different sides instead of on top of each other.
 */
export function placeLabels(
  dots: { at: Point; radius: number; text: string }[],
  obstacles: Box[],
  size: Size,
): LabelSpot[] {
  const placed: Box[] = [];
  const dotBoxes = dots.map((d) => ({ x: d.at.x - d.radius, y: d.at.y - d.radius, width: d.radius * 2, height: d.radius * 2 }));
  return dots.map((dot) => {
    const w = labelWidth(dot.text);
    const h = LABEL_HEIGHT;
    const gap = dot.radius + 4;
    const candidates: LabelSpot[] = [
      { x: dot.at.x + gap, y: dot.at.y, anchor: "start", box: { x: dot.at.x + gap, y: dot.at.y - h / 2, width: w, height: h } },
      { x: dot.at.x - gap, y: dot.at.y, anchor: "end", box: { x: dot.at.x - gap - w, y: dot.at.y - h / 2, width: w, height: h } },
      { x: dot.at.x, y: dot.at.y - gap - h / 2, anchor: "middle", box: { x: dot.at.x - w / 2, y: dot.at.y - gap - h, width: w, height: h } },
      { x: dot.at.x, y: dot.at.y + gap + h / 2, anchor: "middle", box: { x: dot.at.x - w / 2, y: dot.at.y + gap, width: w, height: h } },
    ];
    const cost = (box: Box, order: number) => {
      const outside =
        Math.max(0, -box.x) + Math.max(0, box.x + box.width - size.width) + Math.max(0, -box.y) + Math.max(0, box.y + box.height - size.height);
      const hits = [...dotBoxes, ...obstacles, ...placed].reduce((sum, other) => sum + overlap(box, other), 0);
      return outside * 40 + hits + order; // `order` breaks ties: right, then left, above, below
    };
    const costs = candidates.map((c, i) => cost(c.box, i));
    const best = candidates[costs.indexOf(Math.min(...costs))];
    placed.push(best.box);
    return best;
  });
}

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
