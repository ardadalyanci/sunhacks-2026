import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoEvents, demoScenario } from "@/lib/demo";
import type { DayItem, DayPlan } from "@/lib/types";

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
const savePlan = vi.fn(async () => false); // no database unless a test says otherwise
vi.mock("@/lib/saved-plans", () => ({ savePlan: (...args: unknown[]) => savePlan(...(args as [])) }));

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
    expect(json.briefing).toMatch(/leave (by|at) 10:14 am/i);
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
    // Three calls: ranking, estimates (a call of its own) and the briefing; answer each by its prompt.
    generateJson.mockImplementation(async (...args: unknown[]) =>
      String(args[0]).includes("ASSIGNMENTS:")
        ? { estimates: [{ id: "canvas-assignment-1", minutes: 30 }] }
        : String(args[0]).includes("EVENTS:")
          ? {
              picks: [
                { id: "ev-e2", why: "You might enjoy a quiet break." },
                { id: "ev-e2", why: "duplicate" },
                { id: "ev-nope", why: "not offered" },
                { id: "ev-e1", why: "Robots!" },
              ],
            }
          : { briefing: "Leave by 10:14 AM for CSE 230 at BYENG 210!" },
    );

    const { json } = await plan(baseRequest);

    expect(json.aiUsed).toBe(true);
    expect(json.briefing).toBe("Leave by 10:14 am for CSE 230 at Brickyard 210."); // in the app's own style
    expect(json.suggestions.map((s) => [s.id, s.why])).toEqual([
      ["ev-e2", "You might enjoy a quiet break."],
      ["ev-e1", "Robots."],
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

  it("on a busy day, sends Gemini the events that match the interests, not just the earliest ones", async () => {
    const filler = Array.from({ length: 50 }, (_, n) => ev(`f${n}`, `Noon table ${n}`, "12:00", "12:30", "MU", ["social"]));
    const req = { ...baseRequest, weather: undefined, events: [...filler, ev("late", "Robotics night build", "18:30", "19:30", "MU", ["robotics"])] };
    const { json } = await plan(req);
    const prompt = String(generateJson.mock.calls[0][0]);
    expect(prompt).toContain("ev-late");
    expect(json.suggestions.map((s) => s.id)).toContain("ev-late"); // code fallback ranks by interest
  });

  it("saves the day for the calendar feed only with a valid calendarId, and returns its URL", async () => {
    const id = "3f1c2b4a-8d9e-4f10-9a2b-1c3d4e5f6a7b";
    expect((await plan(baseRequest)).json.calendarUrl).toBeUndefined();
    expect(savePlan).not.toHaveBeenCalled();

    expect((await plan({ ...baseRequest, calendarId: id })).json.calendarUrl).toBeUndefined(); // no database: plan still fine
    savePlan.mockResolvedValueOnce(true);
    const { status, json } = await plan({ ...baseRequest, calendarId: id });
    expect(status).toBe(200);
    expect(json.calendarUrl).toBe(`http://test/api/plan/${id}/calendar`);

    savePlan.mockClear();
    await plan({ ...baseRequest, calendarId: "../../etc" });
    expect(savePlan).not.toHaveBeenCalled();
  });

  it("reaches a class on another campus by ASU shuttle, from the real timetable", async () => {
    const req = {
      ...baseRequest,
      classes: [...baseRequest.classes, { course: "EGR 104", days: ["Mon"], start: "16:30", end: "17:20", location: "Santan Hall 120", campus: "polytechnic" }],
      events: [],
    };
    const { status, json } = await plan(req);
    expect(status).toBe(200);
    const poly = json.items.find((i) => i.title === "EGR 104")!;
    // Hot day: 12-minute walks. Arrive at the Poly stop by 4:18 PM; Gold every 15 min, 50-min ride → stop by 3:13 PM.
    expect(poly.campus).toBe("polytechnic");
    expect(poly.leaveAt).toBe("2026-11-16T15:01:00-07:00");
    expect(poly.via).toContain("Gold shuttle from Forest Avenue and Lemon Street to SIM Building");
    expect(json.items.find((i) => i.title === "MAT 343")!.via).toBeUndefined(); // Tempe classes are untouched
  });

  it("plans a future day from its start and briefs it as a look-ahead", async () => {
    // Sunday evening, looking at Monday: Lab 7 (due Mon 23:59) is open, Saturday's work is not.
    const req = {
      ...baseRequest,
      date: "2026-11-16",
      now: "2026-11-15T17:30:00-07:00",
      deadlines: [
        ...baseRequest.deadlines,
        { id: "canvas-old", type: "deadline", title: "CSE 230: Lab 6", start: "2026-11-15T23:59:00-07:00", source: "canvas", done: false },
      ],
    };
    const { status, json } = await plan(req);
    expect(status).toBe(200);
    const study = json.items.filter((i) => i.type === "study_block");
    expect(study.length).toBeGreaterThan(0);
    expect(study.every((b) => b.start.startsWith("2026-11-16"))).toBe(true);
    expect(json.items.some((i) => i.title.includes("Lab 6"))).toBe(false); // due before Monday: not part of Monday
    expect(json.briefing).toMatch(/^Tomorrow/); // code fallback
    expect(json.briefing).not.toMatch(/today/i);

    const prompt = String(generateJson.mock.calls.at(-1)![0]);
    expect(prompt).toContain("look-ahead at tomorrow, Mon Nov 16");
    expect(prompt).not.toContain("It is now");
    expect(prompt).not.toContain("Current temperature");
    expect(prompt).toContain("Lab 7 for CSE 230: due that day at 11:59 PM");
    expect(prompt).toMatch(/never say "tonight"/i);
    expect(prompt).not.toContain("Lab 6");
  });

  it("gives the briefing prompt exact due days, labeled temperatures and a facts-only rule", async () => {
    await plan(baseRequest);
    const prompt = String(generateJson.mock.calls.at(-1)![0]);
    expect(prompt).toContain("Lab 7 for CSE 230: due today at 11:59 PM");
    expect(prompt).toContain("the Reading quiz for ENG 102: due tomorrow (Tue) at 12:00 PM");
    expect(prompt).toContain("HW 9 for MAT 343 [submitted]");
    expect(prompt).not.toMatch(/HW 9 for MAT 343: due/); // submitted, so not an open assignment
    expect(prompt).toContain("Current temperature: 97°F. Today's high: 101°F.");
    expect(prompt).toMatch(/only the times, places, temperatures and due dates given/i);
  });

  it("does not use a briefing with a stock assistant phrase", async () => {
    generateJson.mockImplementation(async (...args: unknown[]) => {
      if (!String(args[0]).includes("Write what Sol says")) return null;
      const isValid = args[2] as (v: unknown) => boolean;
      const answer = { briefing: "Good morning. Leave by 10:14 AM for CSE 230, and remember to bring water." };
      return isValid(answer) ? answer : null; // generateJson returns null when isValid rejects
    });
    const { json } = await plan(baseRequest);
    expect(json.briefing).not.toMatch(/good morning|remember/i);
    expect(json.briefing).toMatch(/leave (by|at) 10:14 am/i); // the plain-code briefing

    const isValid = generateJson.mock.calls.at(-1)![2] as (v: unknown) => boolean;
    expect(isValid({ briefing: "Be sure to leave by 10:14 AM." })).toBe(false);
    expect(isValid({ briefing: "Leave by 10:14 AM for CSE 230 at BYENG 210." })).toBe(true);
  });

  it("names each assignment once in the briefing facts, the way students say it, with its study time", async () => {
    await plan(baseRequest);
    const prompt = String(generateJson.mock.calls.at(-1)![0]);
    expect(prompt).not.toContain("CSE 230: Lab 7"); // the raw Canvas title
    expect(prompt).not.toContain("Work on:");
    expect(prompt.match(/Lab 7 for CSE 230/g)).toHaveLength(1);
    expect(prompt).toMatch(/Lab 7 for CSE 230: due today at 11:59 PM; study time at \d{1,2}:\d{2} [AP]M/);
    expect(prompt).toMatch(/name each assignment once/i);
    expect(prompt).toMatch(/never repeat a fact/i);
    expect(prompt).toMatch(/"tonight" only for an assignment due today/i);
    expect(prompt).not.toMatch(/hurry/i); // the usual pace gets no pace line
  });
});

describe("POST /api/plan with a slower walking pace", () => {
  // The sample Monday (CSE 230, PHY 121, CSE 240) from the dorm, planned at 8 am, on a 104°F day.
  const monday = demoScenario("2026-11-16", { hot: true, today: "2026-11-16" }).request;
  const leaveTimes = (json: DayPlan) => json.items.filter((i) => i.type === "class").map((c) => [c.title, Date.parse(c.leaveAt!)] as const);

  it("leaves earlier for every class and never puts a study block on a walk", async () => {
    const usual = (await plan(monday)).json;
    const { status, json: slower } = await plan({ ...monday, pace: "slower" });
    expect(status).toBe(200);

    const before = leaveTimes(usual);
    const after = leaveTimes(slower);
    expect(after.map(([title]) => title)).toEqual(["CSE 230", "PHY 121", "CSE 240"]);
    after.forEach(([, leave], n) => expect(leave).toBeLessThan(before[n][1]));

    const study = slower.items.filter((i) => i.type === "study_block");
    expect(study.length).toBeGreaterThan(0);
    for (const s of study) {
      for (const c of slower.items.filter((i) => i.type === "class")) expect(overlaps(s, { ...c, start: c.leaveAt! })).toBe(false);
      for (const sug of slower.suggestions) expect(overlaps(s, sug)).toBe(false);
    }
  });

  it("gives the walk to a suggested event more time too", async () => {
    // Right after CSE 230 ends at 11:20: in the heat the usual walk to an unknown place is 12 minutes, slower it's 19.
    const req = { ...baseRequest, events: [ev("tight", "Robotics demo", "11:35", "12:15", "Engineering Center", ["robotics"])] };
    expect((await plan(req)).json.suggestions.map((s) => s.id)).toEqual(["ev-tight"]);
    expect((await plan({ ...req, pace: "slower" })).json.suggestions).toEqual([]);
  });

  it("tells Sol the leave times already include the extra time, and ignores an unknown pace", async () => {
    await plan({ ...monday, pace: "slower" });
    expect(String(generateJson.mock.calls.at(-1)![0])).toMatch(/already includes it\. Never tell them to hurry/);

    const usual = (await plan(monday)).json;
    const unknown = (await plan({ ...monday, pace: "much slower" })).json;
    expect(leaveTimes(unknown)).toEqual(leaveTimes(usual));
    expect(String(generateJson.mock.calls.at(-1)![0])).not.toMatch(/hurry/);
  });
});

describe("POST /api/plan: Sol's picks keep their time", () => {
  // The sample Sunday (study group 10:30, work shift 1:30 to 4 pm) as of 8 am, with Gemini's live ranking:
  // the lunch & learn first, then robotics night (4:15 pm) and the mixer.
  const sunday = demoScenario("2026-11-15", { today: "2026-11-15" }).request;
  const studyMinutes = (json: DayPlan, part: string) =>
    json.items
      .filter((i) => i.type === "study_block" && i.title.includes(part))
      .reduce((sum, b) => sum + (Date.parse(b.end!) - Date.parse(b.start)) / 60_000, 0);
  const gemini = (picks: string[], minutes: Record<string, number>) =>
    generateJson.mockImplementation(async (...args: unknown[]) => {
      const prompt = String(args[0]);
      if (prompt.includes("ASSIGNMENTS:")) return { estimates: Object.entries(minutes).map(([id, m]) => ({ id, minutes: m })) };
      if (prompt.includes("EVENTS:")) return { picks: picks.map((id) => ({ id, why: "Free lunch and internship tips, right before your work shift." })) };
      return null;
    });

  it("keeps robotics night a suggestion, so 'add the robotics meeting' can find it", async () => {
    gemini(["ev-demo-lunch-talk", "ev-demo-robotics", "ev-demo-mixer"], {
      "canvas-assignment-demo-2": 120, // Lab 7 fills the morning
      "canvas-assignment-demo-3": 45, // the Reading response used to land on 4 pm, on top of robotics night
    });
    const { json } = await plan(sunday);
    expect(json.suggestions.map((s) => s.id)).toEqual(["ev-demo-lunch-talk", "ev-demo-robotics", "ev-demo-mixer"]);
    const study = json.items.filter((i) => i.type === "study_block");
    for (const s of study) expect(overlaps(s, json.suggestions[0])).toBe(false); // only the top pick holds its time
    expect(studyMinutes(json, "Lab 7")).toBe(120);
    expect(studyMinutes(json, "Reading response")).toBeGreaterThanOrEqual(45); // the last piece is at least 25 minutes
  });

  it("does not hold a pick's time when that would cut the study time of urgent homework", async () => {
    // Lab 7 is due at 5 pm and needs 3 hours. Holding the breakfast or the lunch event would leave less than that.
    const req = {
      ...baseRequest,
      deadlines: [{ id: "lab", type: "deadline", title: "CSE 230: Lab 7", start: "2026-11-16T17:00:00-07:00", source: "canvas", done: false }],
      events: [
        ev("e1", "Sun Devil Robotics build night", "15:30", "17:00", "Memorial Union 202", ["robotics"]),
        ev("e5", "Robotics breakfast", "08:45", "10:00", "MU", ["robotics"]),
        ev("e6", "Robotics lunch", "11:30", "13:00", "MU", ["robotics"]),
      ],
    };
    gemini(["ev-e1", "ev-e5", "ev-e6"], { lab: 180 });
    const { json } = await plan(req);
    expect(studyMinutes(json, "Lab 7")).toBe(180);
    expect(json.suggestions.map((s) => s.id)).toEqual(["ev-e1"]);
  });

  it("moves homework only for the event the student adds, never for a new top pick", async () => {
    const picks = ["ev-demo-lunch-talk", "ev-demo-robotics", "ev-demo-mixer"];
    gemini(picks, { "canvas-assignment-demo-2": 120, "canvas-assignment-demo-3": 45 });
    const reading = (json: DayPlan) =>
      json.items.filter((i) => i.type === "study_block" && i.title.includes("Reading response")).map((b) => `${t(b.start)}-${t(b.end)}`);
    const atRest = (await plan(sunday)).json;
    expect(reading(atRest)).toEqual(["16:00-16:45"]); // the lunch & learn holds noon
    expect(atRest.suggestions[0].id).toBe("ev-demo-lunch-talk");

    // "+ Add" on the lunch & learn: robotics night is the top pick now, but it does not start holding 4 pm.
    const lunch = (await plan({ ...sunday, acceptedEventIds: ["demo-lunch-talk"] })).json;
    expect(reading(lunch)).toEqual(["16:00-16:45"]);
    expect(lunch.suggestions.map((s) => s.id)).toEqual(["ev-demo-robotics", "ev-demo-mixer"]);

    // "Add the robotics meeting": robotics needs 4 pm, so the reading moves, and the lunch & learn still holds noon.
    const robotics = (await plan({ ...sunday, acceptedEventIds: ["demo-robotics"] })).json;
    expect(reading(robotics)).toEqual(["17:30-18:15"]);
    expect(robotics.suggestions[0].id).toBe("ev-demo-lunch-talk");
    // Then adding the lunch & learn moves nothing.
    expect(reading((await plan({ ...sunday, acceptedEventIds: ["demo-robotics", "demo-lunch-talk"] })).json)).toEqual(["17:30-18:15"]);

    // Every ranking is the one Gemini gave for the day before any add: one question, asked (and cached) once.
    const rankPrompts = new Set(generateJson.mock.calls.map((c) => String(c[0])).filter((p) => p.includes("EVENTS:")));
    expect(rankPrompts.size).toBe(1);
  });

  it("never lets the top pick take study time from homework due soon", async () => {
    // Lab 7 is due at 10 am and the only pick sits in the morning: the pick is not shown and Lab 7 gets 8 to 10.
    const lunchEarly = { ...demoEvents("2026-11-15")[0], startsAt: "2026-11-15T08:20:00-07:00", endsAt: "2026-11-15T09:20:00-07:00" };
    const req = {
      ...sunday,
      deadlines: sunday.deadlines!.map((d) => (d.id === "canvas-assignment-demo-2" ? { ...d, start: "2026-11-15T10:00:00-07:00" } : d)),
      events: [lunchEarly],
    };
    gemini(["ev-demo-lunch-talk"], { "canvas-assignment-demo-2": 120, "canvas-assignment-demo-3": 45 });
    const { json } = await plan(req);
    expect(studyMinutes(json, "Lab 7")).toBe(120);
    expect(json.suggestions).toEqual([]);
  });

  it("gives Gemini each event's hook and the commitment around it, and asks for varied reasons", async () => {
    await plan(sunday);
    const prompt = String(generateJson.mock.calls.find((c) => String(c[0]).includes("EVENTS:"))![0]);
    expect(prompt).toContain('"about":"Résumés, the online assessment');
    expect(prompt).toContain("Lunch provided.");
    expect(prompt).toContain("after your work shift");
    // "Right after" only for a short break: robotics at 4:15 pm is, the mixer at 5:45 pm is not.
    expect(prompt).toMatch(/"Robotics club build night"[^}]*"fits":"right after your work shift"/);
    expect(prompt).toMatch(/"Hackathon team mixer"[^}]*"fits":"after your work shift, which ends at 4:00\sPM"/);
    expect(prompt).toMatch(/Say "right after" only when "fits" says "right after"/);
    expect(prompt).toMatch(/Never start with "You like" or "You picked"/);
    expect(prompt).toMatch(/No two reasons may start with the same three words/);
    expect(prompt).not.toContain("You picked robotics,");
  });

  it("asks the briefing for Sol's own voice and short event names, and gives the building without the room", async () => {
    await plan(sunday);
    const prompt = String(generateJson.mock.calls.at(-1)![0]);
    expect(prompt).toMatch(/first person at least once/);
    expect(prompt).toMatch(/at most 5 words, never a colon/);
    expect(prompt).toMatch(/A suggested event is not on their day yet: say "you might like" it, never "you have" or "you'll"/);
    expect(prompt).toContain('"Tackle"');
    expect(prompt).toMatch(/Lunch & learn: landing a software internship at 12:00 PM at the MU(;|\n|$)/);
    expect(prompt).toContain("commitment: MAT 343 study group"); // a study group is not a class
  });

  it("does not use a briefing with a broken clock time", async () => {
    generateJson.mockImplementation(async (...args: unknown[]) => {
      if (!String(args[0]).includes("Write what Sol says")) return null;
      const isValid = args[2] as (v: unknown) => boolean;
      expect(isValid({ briefing: "I saved 8 to 00 AM for Lab 7." })).toBe(false);
      expect(isValid({ briefing: "I saved 8 to 10 AM for Lab 7, due at 11:00 PM." })).toBe(true);
      return null;
    });
    await plan(sunday);
    expect(generateJson.mock.calls.some((c) => String(c[0]).includes("Write what Sol says"))).toBe(true);
  });

  it("takes 'now' away from a clock time in Gemini's briefing", async () => {
    generateJson.mockImplementation(async (...args: unknown[]) =>
      String(args[0]).includes("Write what Sol says") ? { briefing: "Work on Lab 7 for CSE 230 right now at 8 AM. I saved the lunch hour for you." } : null,
    );
    const { json } = await plan(sunday);
    expect(json.briefing).toBe("Work on Lab 7 for CSE 230 at 8 am. I saved the lunch hour for you.");
  });
});
