// Loads data/buildings.json (owned by Agent-3) once per server process.
// Format: [{ "id": "BYENG", "name": "Brickyard Engineering", "lat": 33.4235, "lng": -111.9396, "aliases": ["Brickyard"] }]
// If the file is missing or broken, leave times fall back to a fixed walk of about 10 minutes.
// TODO(Agent-1): once data/buildings.json exists, switch to a static JSON import so deploys bundle it;
// data/ sits outside web/ and is not shipped with a deploy of web/.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Building } from "./planner";

let cached: Building[] | null = null;

export async function loadBuildings(): Promise<Building[]> {
  if (cached) return cached;
  // `next dev` runs in web/; the data folder sits next to it at the repo root.
  for (const file of [path.join(process.cwd(), "..", "data", "buildings.json"), path.join(process.cwd(), "data", "buildings.json")]) {
    try {
      const list = JSON.parse(await readFile(/* turbopackIgnore: true */ file, "utf8")) as Building[];
      cached = list.filter((b) => b && typeof b.id === "string" && Number.isFinite(b.lat) && Number.isFinite(b.lng));
      return cached;
    } catch {
      // try the next location
    }
  }
  return [];
}
