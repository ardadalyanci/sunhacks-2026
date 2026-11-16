// Helpers for POST /api/geocode, apart from the route file (a route file may only export its handlers).
import { createLimiter } from "../schedule/rate-limit";

export type Place = { label: string; lat: number; lng: number };

export const geocodeLimit = createLimiter(10, 60_000); // searches per minute per address
export const cache = new Map<string, Place[]>();
let nextSlot = 0; // Nominatim allows one request a second

/** "1001, South Mill Avenue, Tempe, Maricopa County, Arizona, 85281, United States" → "1001 South Mill Avenue, Tempe". */
export function shortLabel(displayName: string): string {
  const drop = /^(United States|Arizona|Maricopa County|Pinal County|\d{5}(-\d{4})?)$/;
  const parts: string[] = [];
  for (const part of displayName.split(", ")) {
    if (drop.test(part)) continue;
    const last = parts.at(-1);
    if (last && /^\d+[A-Za-z]?$/.test(last)) parts[parts.length - 1] = `${last} ${part}`; // "700", "West Rio…" → "700 West Rio…"
    else parts.push(part);
  }
  return parts.slice(0, 3).join(", ");
}

/** Waits for this server's next turn: Nominatim allows one request a second. */
export async function waitForSlot() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 1000;
  if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now));
}


/** Forgets the cache, the limit and the one-a-second slot (tests). */
export function resetSearch() {
  cache.clear();
  geocodeLimit.reset();
  nextSlot = 0;
}
