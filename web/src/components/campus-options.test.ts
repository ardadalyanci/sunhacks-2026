import { describe, expect, it } from "vitest";
import { loadBuildings } from "@/lib/buildings";
import { findBuilding } from "@/lib/planner";
import { BUILDING_HINTS, CAMPUS_CHOICES, STARTS } from "./campus-options";

describe("campus options in Setup", () => {
  it("offers only start buildings and room hints the planner finds on that campus", async () => {
    const buildings = await loadBuildings();
    for (const { id: campus } of CAMPUS_CHOICES) {
      for (const start of STARTS[campus]) expect(findBuilding(buildings, start.id, campus)?.id, `${campus} ${start.id}`).toBe(start.id);
      for (const hint of BUILDING_HINTS[campus]) expect(findBuilding(buildings, `${hint} 120`, campus), `${campus} ${hint}`).toBeDefined();
    }
  });
});
