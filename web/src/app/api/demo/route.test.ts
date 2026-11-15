import { afterEach, describe, expect, it, vi } from "vitest";
import { sanitizePlanRequest } from "@/lib/sanitize";
import type { DayItem, DayPlan, PlanRequest } from "@/lib/types";

vi.mock("@/lib/buildings", () => ({
  loadBuildings: async () => [
    { id: "BYENG", name: "Brickyard Engineering", lat: 33.4235, lng: -111.9397 },
    { id: "COOR", name: "Lattie F. Coor Hall", lat: 33.4209, lng: -111.937 },
    { id: "MU", name: "Memorial Union", lat: 33.4174, lng: -111.9345 },
    { id: "HAYDEN", name: "Hayden Library", lat: 33.419, lng: -111.9341 },
    { id: "MANZ", name: "Manzanita Hall", lat: 33.4171, lng: -111.9395, aliases: ["Manzanita"] },
  ],
}));
vi.mock("@/lib/gemini", () => ({ generateJson: async () => null })); // demo must work offline

const { GET } = await import("./route");
const { POST: plan } = await import("../plan/route");
const { POST: canvas } = await import("../canvas/route");

async function demo(query = "") {
  const res = await GET(new Request(`http://test/api/demo${query}`));
  return { status: res.status, json: await res.json() };
}
async function planFor(request: PlanRequest): Promise<DayPlan> {
  return (await plan(new Request("http://test/api/plan", { method: "POST", body: JSON.stringify(request) }))).json();
}
const overlaps = (a: DayItem, b: DayItem) => Date.parse(a.start) < Date.parse(b.end ?? b.start) && Date.parse(b.start) < Date.parse(a.end ?? a.start);

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/demo", () => {
  it("returns a persona and a clean PlanRequest for the given date", async () => {
    const { status, json } = await demo("?date=2026-11-15");
    expect(status).toBe(200);
    expect(json.persona.name).toBe("Diego Ramírez");
    expect(json.request.date).toBe("2026-11-15");
    expect(json.request.classes.every((c: { days: string[] }) => c.days[0] === "Sun")).toBe(true);
    // Nothing in the sample data is dropped by the request sanitizer.
    const cleaned = sanitizePlanRequest(json.request);
    expect(cleaned.ok && cleaned.value.events?.length).toBe(json.request.events.length);
    expect(cleaned.ok && cleaned.value.deadlines?.length).toBe(json.request.deadlines.length);
  });

  it("defaults to today, supports a hot day and rejects bad dates", async () => {
    expect((await demo()).json.request.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await demo("?hot=1")).json.request.weather.isHot).toBe(true);
    expect((await demo("?date=2026-02-30")).status).toBe(400);
  });
});

describe("demo day through /api/plan", () => {
  afterEach(() => vi.useRealTimers());

  it("produces a full, consistent day with no network", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T07:00:00-07:00")); // due dates are fixed to the real day
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { json } = await demo("?date=2026-11-15&hot=1");
    const day = await planFor(json.request);

    // Sunday (judging day): no classes, but a study group and a shift, so there are still walks to plan.
    const classes = day.items.filter((i) => i.type === "class");
    expect(classes.map((c) => c.title)).toEqual(["Study group: MAT 343", "Work shift"]);
    for (const c of classes) expect(Date.parse(c.leaveAt!)).toBeLessThan(Date.parse(c.start));

    const study = day.items.filter((i) => i.type === "study_block");
    expect(study.length).toBeGreaterThan(0);
    for (const s of study) {
      for (const c of classes) expect(overlaps(s, { ...c, start: c.leaveAt! })).toBe(false);
      for (const sug of day.suggestions) expect(overlaps(s, sug)).toBe(false);
    }

    expect(day.suggestions.length).toBeGreaterThan(0);
    expect(day.suggestions.every((s) => s.why)).toBe(true);
    expect(day.suggestions.map((s) => s.id)).not.toContain("ev-demo-poetry"); // not one of Alex's interests
    expect(day.briefing).toContain("stay in the shade");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/canvas with the demo token", () => {
  afterEach(() => vi.useRealTimers());
  const deadlinesFor = async (date: string) => {
    const res = await canvas(new Request("http://test/api/canvas", { method: "POST", body: JSON.stringify({ token: "demo", date }) }));
    return { status: res.status, list: ((await res.json()).deadlines as DayItem[]).map((d) => [d.title, d.done]) };
  };

  it("returns the demo deadlines without calling Canvas", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T09:00:00-07:00"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await deadlinesFor("2026-11-15")).toEqual({
      status: 200,
      list: [
        ["MAT 343: Homework 9", true],
        ["CSE 230: Lab 7 (pipelining)", false],
        ["ENG 102: Reading response", false],
      ],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows tomorrow's work for tomorrow instead of a second copy of tonight's lab", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T09:00:00-07:00"));
    expect((await deadlinesFor("2026-11-16")).list).toEqual([
      ["ENG 102: Reading response", false],
      ["CSE 240: Quiz 5 (pointers)", false],
    ]);
  });
});

describe("GET /api/demo for a later day", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps 8 AM for today and uses the real clock for a look-ahead", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T17:40:00-07:00"));
    expect((await demo("?date=2026-11-14")).json.request.now).toBe("2026-11-14T08:00:00-07:00");
    const ahead = (await demo("?date=2026-11-15")).json.request;
    expect(ahead.now).toBe("2026-11-14T17:40:00-07:00");
    const day = await planFor(ahead);
    expect(day.briefing).toMatch(/^Tomorrow, Sun Nov 15\./);
    expect(day.items.filter((i) => i.type === "class")).toHaveLength(2); // the whole Sunday, not just what is left of today
  });
});
