import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayItem } from "@/lib/types";
import type { DayResponse } from "@/lib/api-client";

vi.mock("@/lib/buildings", () => ({
  loadBuildings: async () => [
    { id: "BYENG", name: "Brickyard Engineering", lat: 33.4235, lng: -111.9397 },
    { id: "COOR", name: "Lattie F. Coor Hall", lat: 33.4209, lng: -111.937 },
    { id: "MU", name: "Memorial Union", lat: 33.4174, lng: -111.9345 },
    { id: "HAYDEN", name: "Hayden Library", lat: 33.419, lng: -111.9341 },
    { id: "MANZ", name: "Manzanita Hall", lat: 33.4171, lng: -111.9395, aliases: ["Manzanita"] },
  ],
}));
vi.mock("@/lib/gemini", () => ({ generateJson: async () => null }));

const { POST } = await import("./route");

async function day(body: unknown): Promise<{ status: number; json: DayResponse & { error?: string } }> {
  const res = await POST(new Request("http://test/api/day", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}
const kinds = (items: DayItem[]) => items.map((i) => i.kind);

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/day in demo mode", () => {
  it("returns the demo day in the public types, with no network", async () => {
    const { status, json } = await day({ date: "2026-11-15" });
    expect(status).toBe(200);
    expect(json.demo).toBe(true);
    expect(json.setup.name).toBe("Alex");
    expect(fetchMock).not.toHaveBeenCalled();

    const { items } = json.plan;
    // Every class has a leave marker right before it, pointing at it.
    for (const cls of items.filter((i) => i.kind === "class")) {
      const idx = items.indexOf(cls);
      expect(items[idx - 1]).toMatchObject({ kind: "leave", forItemId: cls.id });
      expect(items[idx - 1].walkMinutes).toBeGreaterThan(0);
      expect(cls.course).toBe(cls.title);
      expect(["BYENG", "COOR"]).toContain(cls.building);
    }
    // Assignments carry course, due time, submitted, and an estimate when open.
    const lab = items.find((i) => i.kind === "assignment" && i.title === "Lab 7 (pipelining)");
    expect(lab).toMatchObject({ course: "CSE 230", dueAt: "2026-11-15T23:59:00-07:00", submitted: false, estimatedMinutes: 60 });
    const homework = items.find((i) => i.title === "Homework 9");
    expect(homework?.submitted).toBe(true);
    expect(homework?.estimatedMinutes).toBeUndefined(); // no work left
    // Study blocks point at their assignment.
    const study = items.filter((i) => i.kind === "study");
    expect(study.length).toBeGreaterThan(0);
    for (const s of study) expect(s.forItemId).toMatch(/^canvas-assignment-demo-/);
    // Items are sorted by time.
    const times = items.map((i) => i.startsAt ?? i.dueAt ?? "");
    expect([...times].sort()).toEqual(times);

    expect(json.plan.briefing.length).toBeGreaterThan(20);
    expect(json.plan.heatAlert).toBeUndefined(); // a mild November day
    expect(json.dueSoon.map((d) => [d.title, d.course])).toEqual([["Reading response", "ENG 102"]]);
  });

  it("puts today's picks first, then matching events later in the week", async () => {
    const { json } = await day({ date: "2026-11-15" });
    const dates = json.picks.map((p) => p.event.startsAt.slice(0, 10));
    expect(dates[0]).toBe("2026-11-15");
    expect(dates).toContain("2026-11-16");
    expect(json.picks.every((p) => p.why.length > 0)).toBe(true);
    expect(json.picks.map((p) => p.event.title)).not.toContain("Poetry open mic"); // not one of Alex's interests
    const scores = json.picks.map((p) => p.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("shows a heat alert on the hot preview, at the hottest walk", async () => {
    const { json } = await day({ date: "2026-11-15", previewHot: true });
    const alert = json.plan.heatAlert!;
    expect(alert.feelsLikeF).toBeGreaterThanOrEqual(95);
    expect(json.plan.items.some((i) => i.kind === "leave" && i.startsAt === alert.at)).toBe(true);
    expect(alert.message).toMatch(/^Feels like \d+°F when you walk to .+ at \d+:\d\d [AP]M\. Take water/);
  });

  it("adds accepted events (UI ids or raw ids) with a leave marker, and stops suggesting them", async () => {
    const { json } = await day({ date: "2026-11-15", acceptedEventIds: ["event-demo-robotics"] });
    const ev = json.plan.items.find((i) => i.id === "event-demo-robotics");
    expect(ev).toMatchObject({ kind: "event", title: "Robotics club build night" });
    expect(json.plan.items.find((i) => i.kind === "leave" && i.forItemId === "event-demo-robotics")).toBeDefined();
    expect(json.picks.map((p) => p.event.id)).not.toContain("demo-robotics");
  });
});

describe("POST /api/day with a real setup", () => {
  const setup = {
    name: "Maya",
    interests: ["Robotics"],
    classes: [{ course: "CSE 230", days: ["Mon"], start: "09:00", end: "09:50", building: "BYENG", room: "210" }],
  };
  const canvasItem = {
    plannable_type: "assignment",
    plannable_id: 7,
    context_name: "CSE 230: Computer Org",
    plannable: { title: "Lab 7", due_at: "2026-11-17T06:59:00Z" },
    submissions: { submitted: false },
  };

  it("plans from Canvas with the student's token and their own classes", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([canvasItem]), { status: 200 }));
    const { status, json } = await day({ setup, canvasToken: "real-token", date: "2026-11-16", now: "2026-11-16T07:00:00-07:00" });
    expect(status).toBe(200);
    expect(json.demo).toBe(false);
    expect(json.setup.name).toBe("Maya");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer real-token");
    expect(kinds(json.plan.items)).toEqual(expect.arrayContaining(["leave", "class", "assignment", "study"]));
    expect(json.plan.items.find((i) => i.kind === "class")).toMatchObject({ building: "BYENG", location: "BYENG 210" });
    expect(json.picks).toEqual([]); // no event feeds yet outside demo mode
  });

  it("passes Canvas errors through without echoing the token", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    const res = await day({ setup, canvasToken: "secret-token-123", date: "2026-11-16" });
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.json)).not.toContain("secret-token-123");
  });

  it("uses demo deadlines for the token 'demo' with the student's own classes", async () => {
    const { json } = await day({ setup, canvasToken: "demo", date: "2026-11-16" });
    expect(json.demo).toBe(true);
    expect(json.setup.name).toBe("Maya");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(json.plan.items.some((i) => i.kind === "assignment")).toBe(true);
  });

  it("answers 400 for unusable bodies", async () => {
    expect((await day("nope")).status).toBe(400);
    expect((await day("null")).status).toBe(400);
    expect((await day([])).status).toBe(400);
    expect((await day({ date: "2026-02-30" })).status).toBe(400);
    expect((await day({ setup, canvasToken: "x".repeat(301) })).status).toBe(400);
  });
});
