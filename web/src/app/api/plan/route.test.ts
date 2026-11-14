import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DayItem, DayPlan } from "@/lib/engine-types";

vi.mock("@/lib/buildings", () => ({
  loadBuildings: async () => [
    { id: "BYENG", name: "Brickyard Engineering", lat: 33.4235, lng: -111.9397 },
    { id: "COOR", name: "Lattie F. Coor Hall", lat: 33.4209, lng: -111.937 },
    { id: "MU", name: "Memorial Union", lat: 33.4174, lng: -111.9345 },
    { id: "MANZ", name: "Manzanita Hall", lat: 33.4171, lng: -111.9395, aliases: ["Manzanita"] },
  ],
}));
const generateJson = vi.fn();
vi.mock("@/lib/gemini", () => ({ generateJson: (...args: unknown[]) => generateJson(...args) }));

const { POST } = await import("./route");

const ev = (id: string, title: string, start: string, end: string, location: string, tags: string[]) => ({
  id,
  kind: "club_event",
  title,
  organizer: "Club",
  description: "",
  url: `https://example.org/${id}`,
  startsAt: `2026-11-16T${start}:00-07:00`,
  endsAt: `2026-11-16T${end}:00-07:00`,
  location,
  tags,
  source: "sundevilcentral",
  fetchedAt: "2026-11-16T08:00:00-07:00",
});

const baseRequest = {
  date: "2026-11-16",
  now: "2026-11-16T08:30:00-07:00",
  startBuildingId: "Manzanita",
  interests: ["robotics"],
  weather: { tempF: 97, highF: 101, isHot: true },
  classes: [
    { course: "CSE 230", days: ["Mon", "Wed", "Fri"], start: "10:30", end: "11:20", location: "BYENG 210" },
    { course: "MAT 343", days: ["Mon", "Wed"], start: "13:30", end: "14:45", location: "COOR 170" },
    { course: "ENG 102", days: ["Tue", "Thu"], start: "09:00", end: "10:15", location: "COOR 120" },
  ],
  deadlines: [
    { id: "canvas-assignment-1", type: "deadline", title: "CSE 230: Lab 7", start: "2026-11-16T23:59:00-07:00", source: "canvas", done: false },
    { id: "canvas-assignment-2", type: "deadline", title: "MAT 343: HW 9", start: "2026-11-16T23:59:00-07:00", source: "canvas", done: true },
    { id: "canvas-quiz-3", type: "deadline", title: "ENG 102: Reading quiz", start: "2026-11-17T12:00:00-07:00", source: "canvas", done: false },
  ],
  events: [
    ev("e1", "Sun Devil Robotics build night", "16:00", "17:00", "Memorial Union 202", ["robotics", "engineering"]),
    ev("e2", "Poetry open mic", "15:00", "15:45", "Hayden Library", ["writing"]),
    ev("e3", "Startup pitch workshop", "13:45", "14:30", "MU", ["startups"]), // during MAT 343
    ev("e4", "Robotics office hours", "11:20", "12:00", "MU", ["robotics"]), // no time to walk from BYENG
  ],
};

async function plan(body: unknown): Promise<{ status: number; json: DayPlan & { error?: string } }> {
  const res = await POST(new Request("http://test/api/plan", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}
const t = (iso?: string) => iso?.slice(11, 16);
const overlaps = (a: DayItem, b: DayItem) => Date.parse(a.start) < Date.parse(b.end ?? b.start) && Date.parse(b.start) < Date.parse(a.end ?? a.start);

beforeEach(() => generateJson.mockReset().mockResolvedValue(null)); // Gemini unavailable unless a test says otherwise

describe("POST /api/plan without Gemini", () => {
  it("builds the day: today's classes with leave times, deadlines, study blocks and a fitting suggestion", async () => {
    const { status, json } = await plan(baseRequest);
    expect(status).toBe(200);
    expect(json.aiUsed).toBe(false);

    const classes = json.items.filter((i) => i.type === "class");
    expect(classes.map((c) => [c.title, t(c.start), t(c.leaveAt)])).toEqual([
      ["CSE 230", "10:30", "10:14"],
      ["MAT 343", "13:30", "13:19"],
    ]);
    expect(json.items.filter((i) => i.type === "deadline").map((d) => [d.title, d.done])).toEqual([
      ["CSE 230: Lab 7", false],
      ["MAT 343: HW 9", true],
    ]);
    expect(json.suggestions.map((s) => s.id)).toEqual(["ev-e1"]);
    expect(json.suggestions[0].why).toContain("robotics");
    expect(json.briefing).toContain("leave by 10:14 AM");
  });

  it("never puts a study block on top of a class walk, a class or a suggestion", async () => {
    const { json } = await plan(baseRequest);
    const study = json.items.filter((i) => i.type === "study_block");
    expect(study.length).toBeGreaterThan(0);
    const classes = json.items.filter((i) => i.type === "class");
    for (const s of study) {
      expect(Date.parse(s.end!) - Date.parse(s.start)).toBeGreaterThanOrEqual(25 * 60_000);
      for (const c of classes) expect(overlaps(s, { ...c, start: c.leaveAt! })).toBe(false);
      for (const sug of json.suggestions) expect(overlaps(s, sug)).toBe(false);
    }
  });

  it("puts accepted events on the timeline with a leave time and stops suggesting them", async () => {
    const { json } = await plan({ ...baseRequest, acceptedEventIds: ["e1"] });
    const event = json.items.find((i) => i.id === "ev-e1");
    expect(event).toMatchObject({ type: "event", leaveAt: "2026-11-16T15:48:00-07:00" });
    expect(json.suggestions.find((s) => s.id === "ev-e1")).toBeUndefined();
  });

  it("answers 400 for unusable bodies and never 500 for broken fields", async () => {
    expect((await plan("not json")).status).toBe(400);
    expect((await plan("null")).status).toBe(400);
    expect((await plan({ classes: "CSE 230" })).status).toBe(400);
    const broken = await plan({
      date: "2026-02-30",
      classes: [{ course: "X", days: ["Mon"], start: "1:30 PM", end: "2 PM" }, null],
      deadlines: [{ id: "d", type: "deadline", title: "D", start: "tbd" }],
      events: [null, { id: "e", title: "E", startsAt: "soon" }],
      interests: "robotics",
      acceptedEventIds: [5],
    });
    expect(broken.status).toBe(200);
    expect(broken.json.items).toEqual([]);
  });
});

describe("POST /api/plan with Gemini", () => {
  it("uses Gemini's ranking and estimates, ignoring duplicate and unknown ids", async () => {
    generateJson
      .mockResolvedValueOnce({
        picks: [
          { id: "ev-e2", why: "You might enjoy a quiet break." },
          { id: "ev-e2", why: "duplicate" },
          { id: "ev-nope", why: "not offered" },
          { id: "ev-e1", why: "Robots!" },
        ],
        estimates: [{ id: "canvas-assignment-1", minutes: 30 }],
      })
      .mockResolvedValueOnce({ briefing: "Good morning from Gemini." });

    const { json } = await plan(baseRequest);

    expect(json.aiUsed).toBe(true);
    expect(json.briefing).toBe("Good morning from Gemini.");
    expect(json.suggestions.map((s) => [s.id, s.why])).toEqual([
      ["ev-e2", "You might enjoy a quiet break."],
      ["ev-e1", "Robots!"],
    ]);
    const labBlocks = json.items.filter((i) => i.type === "study_block" && i.title.includes("Lab 7"));
    const minutes = labBlocks.reduce((sum, b) => sum + (Date.parse(b.end!) - Date.parse(b.start)) / 60_000, 0);
    expect(minutes).toBe(30);

    // The ranking prompt only offers events that fit the day.
    const prompt = String(generateJson.mock.calls[0][0]);
    expect(prompt).toContain("ev-e1");
    expect(prompt).not.toContain("ev-e3");
    expect(prompt).not.toContain("ev-e4");
  });
});
