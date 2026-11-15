// The walk the Today screen leads with, and building names the way students say them. No React here.
import raw from "@/lib/buildings.json";
import type { DayItem } from "@/lib/types";

type Building = { id: string; name: string; lat: number; lng: number; aliases?: string[] };
const BUILDINGS = raw as Building[];

/** The building a location like "BYENG 210" or "Hayden Library" is in, and the room if one was given. */
export function findPlace(location: string | undefined): { building?: Building; room: string } {
  if (!location) return { room: "" };
  const [first, ...rest] = location.trim().split(/\s+/);
  const byId = BUILDINGS.find((b) => b.id.toLowerCase() === first.toLowerCase());
  if (byId) return { building: byId, room: rest.join(" ") };
  const lower = location.toLowerCase();
  const byName = BUILDINGS.find((b) => [b.name, ...(b.aliases ?? [])].some((n) => lower.startsWith(n.toLowerCase())));
  if (!byName) return { room: "" };
  const name = [byName.name, ...(byName.aliases ?? [])].find((n) => lower.startsWith(n.toLowerCase()))!;
  return { building: byName, room: location.trim().slice(name.length).trim() };
}

// What students call a building when the official name is long: Brickyard, Coor Hall, the MU, Hayden.
const SPOKEN: Record<string, string> = { MU: "the MU", LIB: "Hayden", MANZ: "Manzanita", TOOKR: "Tooker" };

/** "Brickyard 210", "the MU 230", "Hayden": a location in the words a student would use. */
export function placeLabel(location: string | undefined): string {
  const { building, room } = findPlace(location);
  if (!building) return location ?? "";
  const word = SPOKEN[building.id] ?? (building.aliases?.[0] && building.aliases[0].length < building.name.length ? building.aliases[0] : building.name);
  return room ? `${word} ${room}` : word;
}

/** Google Maps walking directions to the building (or to the place's name in Tempe). */
export function walkLink(location: string | undefined): string {
  const { building } = findPlace(location);
  const destination = building ? `${building.lat},${building.lng}` : `${location ?? ""}, Tempe, AZ`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`;
}

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
