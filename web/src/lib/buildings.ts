// Tempe building coordinates from data/buildings.json (owned by Agent-3).
// Format: [{ "id": "BYENG", "name": "Brickyard Engineering", "lat": 33.4235, "lng": -111.9396, "aliases": ["Brickyard"] }]
// The file is imported, so the build bundles it: a deploy of web/ (Vercel Root Directory "web") does not ship
// data/ at runtime. next.config.ts sets turbopack.root to the repo root so this import can reach data/.
import raw from "../../../data/buildings.json";
import type { Building } from "./planner";

const buildings: Building[] = (raw as Building[]).filter((b) => b && typeof b.id === "string" && Number.isFinite(b.lat) && Number.isFinite(b.lng));

export async function loadBuildings(): Promise<Building[]> {
  return buildings;
}
