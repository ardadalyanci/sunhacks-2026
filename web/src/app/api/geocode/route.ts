// POST /api/geocode { q: "1001 S Mill Ave, Tempe" } → { places: [{ label, lat, lng }] }
// Finds an off-campus student's home on the map, so Sol can time the trip to class. One search per button press,
// through OpenStreetMap's Nominatim (https://operations.osmfoundation.org/policies/nominatim/): no autocomplete, at
// most one request a second from this server, results bounded to the Phoenix area, cached. The address is in the
// body, never in a URL of ours, and is never logged or stored; the browser keeps only the point it picks.
import { inPhoenixArea, roundPoint } from "@/lib/commute";
import { clientAddress } from "../schedule/rate-limit";
import { type Place, cache, geocodeLimit, shortLabel, waitForSlot } from "./search";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const VIEWBOX = "-112.8,34.0,-111.2,33.0"; // west, north, east, south: the Phoenix area around ASU's campuses
const MAX_RESULTS = 5;
const TIMEOUT_MS = 8000;

function error(message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}

export async function POST(request: Request) {
  if (!geocodeLimit.allow(clientAddress(request))) {
    return error("That is a lot of searches in a row. Wait a minute and try again.", 429, { "Retry-After": "60" });
  }
  const body = (await request.json().catch(() => null)) as { q?: unknown } | null;
  const q = typeof body?.q === "string" ? body.q.trim().replace(/\s+/g, " ") : "";
  if (q.length < 3 || q.length > 200) return error("Type your street address, like 1001 S Mill Ave, Tempe.", 400);

  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached) return Response.json({ places: cached });

  const url = new URL(NOMINATIM);
  url.search = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: String(MAX_RESULTS),
    countrycodes: "us",
    viewbox: VIEWBOX,
    bounded: "1",
  }).toString();
  let rows: { display_name?: unknown; lat?: unknown; lon?: unknown }[];
  try {
    await waitForSlot();
    const res = await fetch(url, {
      headers: { "User-Agent": "Sundial/1.0 (+https://sundial.club)", "Accept-Language": "en" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    rows = await res.json();
    if (!Array.isArray(rows)) throw new Error("Nominatim sent no list");
  } catch {
    return error("The map search is not answering right now. Try again in a minute.", 502);
  }

  const places: Place[] = [];
  for (const row of rows) {
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (typeof row.display_name !== "string" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!inPhoenixArea({ lat, lng })) continue;
    places.push({ label: shortLabel(row.display_name), ...roundPoint({ lat, lng }) });
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, places);
  return Response.json({ places });
}
