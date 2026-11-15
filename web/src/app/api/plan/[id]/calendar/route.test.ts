import { describe, expect, it, vi } from "vitest";

const loadPlans = vi.fn();
vi.mock("@/lib/saved-plans", async (importActual) => ({ ...(await importActual<typeof import("@/lib/saved-plans")>()), loadPlans: (...a: unknown[]) => loadPlans(...a) }));

const { GET } = await import("./route");

const ID = "3f1c2b4a-8d9e-4f10-9a2b-1c3d4e5f6a7b";
const call = (id: string) => GET(new Request(`http://test/api/plan/${id}/calendar`), { params: Promise.resolve({ id }) });

describe("GET /api/plan/[id]/calendar", () => {
  it("serves the saved days as a calendar feed", async () => {
    loadPlans.mockResolvedValueOnce([
      { date: "2026-11-16", items: [{ id: "class-0-CSE230", type: "class", title: "CSE 230", start: "2026-11-16T10:30:00-07:00", source: "planner" }] },
    ]);
    const res = await call(ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(await res.text()).toContain("SUMMARY:CSE 230");
  });

  it("answers 404 for a bad id or an empty calendar, 503 without the database", async () => {
    expect((await call("not-a-uuid")).status).toBe(404);
    loadPlans.mockResolvedValueOnce([]);
    expect((await call(ID)).status).toBe(404);
    loadPlans.mockResolvedValueOnce(null);
    expect((await call(ID)).status).toBe(503);
  });
});
