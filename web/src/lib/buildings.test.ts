import { describe, expect, it, vi } from "vitest";
import { findBuilding } from "./planner";

describe("loadBuildings", () => {
  it("serves the bundled data/buildings.json without reading the disk at runtime", async () => {
    vi.doMock("node:fs/promises", () => ({ readFile: () => Promise.reject(new Error("no disk on Vercel")) }));
    const { loadBuildings } = await import("./buildings");
    const buildings = await loadBuildings();
    expect(buildings.length).toBeGreaterThanOrEqual(50);
    expect(findBuilding(buildings, "BYENG 210")?.id).toBe("BYENG");
    expect(findBuilding(buildings, "COOR 170")?.id).toBe("COOR");
    expect(buildings.every((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng))).toBe(true);
    vi.doUnmock("node:fs/promises");
  });
});
