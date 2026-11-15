import { describe, expect, it, vi } from "vitest";
import { parseIcs } from "@/lib/feeds/ical";
import type { DayPlan } from "@/lib/types";

vi.mock("@/lib/buildings", () => ({
  loadBuildings: async () => [
    { id: "BYENG", name: "Brickyard Engineering", lat: 33.4236, lng: -111.9395 },
    { id: "COOR", name: "Lattie F. Coor Hall", lat: 33.4194, lng: -111.9373 },
    { id: "MANZ", name: "Manzanita Hall", lat: 33.4225, lng: -111.9301, aliases: ["Manzanita"] },
  ],
}));
vi.mock("@/lib/gemini", () => ({ generateJson: async () => null }));
const { POST } = await import("./route");
const { POST: planPost } = await import("../plan/route");
const { demoScenario } = await import("@/lib/demo");

const post = (body: unknown) => POST(new Request("http://t/api/calendar", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/calendar", () => {
  it("turns the demo day from /api/plan into a downloadable calendar with leave reminders", async () => {
    const planRes = await planPost(new Request("http://t/api/plan", { method: "POST", body: JSON.stringify(demoScenario("2026-11-16").request) }));
    const plan = (await planRes.json()) as DayPlan;
    const res = await post({ plan, name: "Alex" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="daypilot-2026-11-16.ics"');
    const ics = await res.text();
    expect(parseIcs(ics).map((e) => e.summary)).toEqual(expect.arrayContaining(plan.items.filter((i) => i.type === "class").map((i) => i.title)));
    expect(ics).toContain("TRIGGER;VALUE=DATE-TIME:");
    expect(ics).toContain("X-WR-CALNAME:DayPilot: Alex");
  });

  it("drops malformed items instead of failing", async () => {
    const plan = { date: "2026-11-16", items: [{ id: "x", type: "event", title: "Robotics build night", start: "2026-11-16T16:15:00-07:00" }, { id: "bad", type: "nope", title: "?", start: "x" }, null] };
    const events = parseIcs(await (await post({ plan })).text());
    expect(events.map((e) => e.summary)).toEqual(["Robotics build night"]);
  });

  it("rejects a body that is not a plan", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post("nope")).status).toBe(400);
    expect((await post({ plan: { date: "2026-02-30", items: [] } })).status).toBe(400);
  });
});
