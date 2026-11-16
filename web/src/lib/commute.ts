// An off-campus student's trip to class, from their home point on the map (picked in Setup) to the building.
// Straight-line distance times a road factor, at a typical speed for the way they travel, plus the fixed minutes
// each way needs (parking, locking a bike, waiting for the bus). A rough estimate, so Setup lets the student type
// their own minutes instead. Pure functions, shared by the planner and the Setup screen.
import { CAMPUSES, CAMPUS_INFO } from "./campuses";
import type { CampusId, CommuteBy } from "./types";

export type Point = { lat: number; lng: number };

const ROAD_FACTOR = 1.3; // streets are not straight lines
const M_PER_MILE = 1609.344;
export const MAX_COMMUTE_MIN = 120;

// m/min while moving, and the minutes every trip adds. `outdoors` trips get the heat minutes walks get.
const MODES: Record<CommuteBy, { mPerMin: number; extraMin: number; outdoors: boolean }> = {
  walk: { mPerMin: 80, extraMin: 2, outdoors: true }, // about 3 mph, as campus walks
  bike: { mPerMin: 250, extraMin: 3, outdoors: true }, // about 9 mph, plus locking up
  scooter: { mPerMin: 220, extraMin: 2, outdoors: true }, // about 8 mph
  drive: { mPerMin: 500, extraMin: 10, outdoors: false }, // about 19 mph through lights, plus parking and walking in
  bus: { mPerMin: 300, extraMin: 15, outdoors: false }, // about 11 mph with stops, plus the walk to the stop and the wait
};

/** "From home by car", "From home on foot". */
export const COMMUTE_WORDS: Record<CommuteBy, string> = {
  walk: "on foot",
  bike: "by bike",
  scooter: "by scooter",
  drive: "by car",
  bus: "by bus or light rail",
};

export function metersBetween(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Road miles between two points, as the estimate uses them. */
export function roadMiles(from: Point, to: Point): number {
  return (metersBetween(from, to) * ROAD_FACTOR) / M_PER_MILE;
}

/**
 * Minutes from `from` to `to` traveling `by`. A hot day adds the walk's heat minutes to a trip outdoors (2, or 5
 * at the slower pace), and the slower pace makes a walk 35% longer, as on campus.
 */
export function commuteMinutes(from: Point, to: Point, by: CommuteBy, opts: { hot?: boolean; slower?: boolean } = {}): number {
  const mode = MODES[by];
  let moving = (metersBetween(from, to) * ROAD_FACTOR) / mode.mPerMin;
  if (by === "walk" && opts.slower) moving *= 1.35;
  const heat = opts.hot && mode.outdoors ? (opts.slower ? 5 : 2) : 0;
  return Math.max(1, Math.ceil(moving + mode.extraMin + heat));
}

/** "0.4 miles", "3.2 miles". */
export function milesText(miles: number): string {
  const rounded = miles < 10 ? Math.round(miles * 10) / 10 : Math.round(miles);
  return `${rounded} ${rounded === 1 ? "mile" : "miles"}`;
}

export const campusPoint = (campus: CampusId): Point => ({ lat: CAMPUS_INFO[campus].latitude, lng: CAMPUS_INFO[campus].longitude });

/** The ASU campus closest to a point. */
export function nearestCampus(p: Point): CampusId {
  return CAMPUSES.reduce((best, c) => (metersBetween(p, campusPoint(c)) < metersBetween(p, campusPoint(best)) ? c : best));
}

/** Three decimals, about 100 m: plenty for minutes, and not the student's exact door. */
export const roundPoint = (p: Point): Point => ({ lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 });

/** The Phoenix area around ASU's campuses; a home point outside it is a mistake. */
export const inPhoenixArea = (p: Point) => p.lat >= 33.0 && p.lat <= 34.0 && p.lng >= -112.8 && p.lng <= -111.2;
