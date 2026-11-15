import { describe, expect, it } from "vitest";
import buildings from "@/lib/buildings.json";
import { demoScenario } from "@/lib/demo";
import type { DayItem, DayPlan, Opportunity, PlanRequest } from "@/lib/types";
import { planFacts, planSources } from "./plan-facts";

const SAT = "2026-11-14";
const MON = "2026-11-16";
const at = (date: string, hhmm: string) => `${date}T${hhmm}:00-07:00`;

const item = (date: string, part: Partial<DayItem> & Pick<DayItem, "id" | "type" | "title">, start: string, end?: string, leave?: string): DayItem => ({
  source: "planner",
  ...part,
  start: at(date, start),
  end: end ? at(date, end) : undefined,
  leaveAt: leave ? at(date, leave) : undefined,
});

const basePlan = (date: string, items: DayItem[], extra: Partial<DayPlan> = {}): DayPlan => ({
  date,
  items,
  suggestions: [],
  weather: { tempF: 78, highF: 84, isHot: false },
  briefing: "",
  aiUsed: true,
  ...extra,
});

const suggestion = (date: string, why: string): DayItem =>
  item(date, { id: "ev-demo-robotics", type: "event", title: "Robotics club build night", why, source: "asu_events" }, "16:15", "17:30");

const facts = (request: PlanRequest, plan: DayPlan, isDemo = true, later = false) =>
  Object.fromEntries(planFacts(request, plan, { isDemo, later }).map((f) => [f.key, f.text]));

// The sample Saturday as /api/plan would answer it at 8 am.
function saturday(extra: Partial<DayPlan> = {}) {
  const { request } = demoScenario(SAT, { today: SAT });
  const plan = basePlan(
    SAT,
    [
      item(SAT, { id: "study-lab7", type: "study_block", title: "Work on: CSE 230: Lab 7 (pipelining)" }, "08:00", "09:47"),
      item(SAT, { id: "class-0", type: "class", title: "Work shift", location: "Memorial Union" }, "10:00", "14:00", "09:52"),
      item(SAT, { id: "class-1", type: "class", title: "CSE 230 study group", location: "Hayden Library" }, "15:00", "16:00", "14:56"),
      ...(request.deadlines ?? []),
    ],
    { suggestions: [suggestion(SAT, "Robotics is your thing, and you're free after your study group.")], ...extra },
  );
  return { request, plan };
}

describe("planFacts on the sample Saturday", () => {
  const { request, plan } = saturday();
  const f = facts(request, plan);

  it("lists the steps in the planner's order", () => {
    expect(planFacts(request, plan, { isDemo: true, later: false }).map((x) => x.key)).toEqual([
      "schedule",
      "canvas",
      "walks",
      "weather",
      "study",
      "events",
      "who",
    ]);
  });

  it("names the day's commitments", () => {
    expect(f.schedule).toBe("2 things on Saturday: your work shift and your CSE 230 study group.");
  });

  it("says the assignments are samples, with what is turned in and what is still due", () => {
    expect(f.canvas).toBe("3 sample assignments: 1 turned in, Lab 7 due tonight at 11:59 pm and Reading response due tomorrow at noon.");
  });

  it("counts the walks and their minutes from the leave times, and the buildings from the data file", () => {
    expect(f.walks).toBe(
      `2 walks, 12 minutes on foot in all, starting from Manzanita. Each leave time comes from distances between ${buildings.length} ASU buildings from OpenStreetMap.`,
    );
  });

  it("calls the sample weather sample weather", () => {
    expect(f.weather).toBe("Sample weather: 78°F now and a high of 84°F.");
  });

  it("gives each assignment's study time and when", () => {
    expect(f.study).toBe("Lab 7: 1 h 47 min, 8–9:47 am. It sits in free time before it's due.");
  });

  it("counts the sample events and says Gemini ranked them against the interests", () => {
    expect(f.events).toBe(
      "5 sample events, 5 on Saturday. I picked 1 for you. Gemini ranked the ones that fit your free time against your interests: robotics, software and hackathons.",
    );
  });

  it("says which parts Gemini did and which parts code did", () => {
    expect(f.who).toBe(
      "Gemini wrote my words, ranked the events and estimated how long your homework takes. Plain code did the math: free gaps, walks, heat and where each block goes.",
    );
  });

  it("mentions the live feeds when they are mixed in", () => {
    const live: Opportunity = { ...request.events![0], id: "asu-1", source: "asu_events", startsAt: at(MON, "18:00") };
    const mixed = facts({ ...request, events: [...request.events!, live, { ...live, id: "asu-2" }] }, plan);
    expect(mixed.events).toMatch(/^5 sample events mixed with 2 from the live ASU feeds this week, 5 on Saturday\./);
  });
});

describe("planFacts on the sample Monday", () => {
  const { request } = demoScenario(MON, { today: SAT });
  const plan = basePlan(MON, [
    item(MON, { id: "c0", type: "class", title: "CSE 230", location: "BYENG 210" }, "10:30", "11:20", "10:16"),
    item(MON, { id: "c1", type: "class", title: "PHY 121", location: "PSF 166" }, "12:15", "13:05", "12:09"),
    item(MON, { id: "c2", type: "class", title: "CSE 240", location: "BYENG 190" }, "15:00", "15:50", "14:54"),
    item(MON, { id: "s0", type: "study_block", title: "Work on: CSE 240: Quiz 5 (pointers)" }, "08:00", "09:00"),
    item(MON, { id: "s1", type: "study_block", title: "Work on: CSE 240: Quiz 5 (pointers)" }, "13:05", "13:35"),
    item(MON, { id: "s2", type: "study_block", title: "Work on: PHY 121: Problem set 8" }, "16:00", "17:00"),
  ]);
  const later = facts(request, plan, true, true);

  it("names the classes", () => {
    expect(later.schedule).toBe("3 classes on Monday: CSE 230, PHY 121 and CSE 240.");
  });

  it("names due days by weekday on a look-ahead", () => {
    expect(later.canvas).toBe("2 sample assignments: Quiz 5 due Monday at 11:59 pm and Problem set 8 due Tuesday at 11:59 pm.");
  });

  it("gives only the high on a look-ahead", () => {
    expect(later.weather).toBe("Sample weather: a high of 84°F.");
  });

  it("adds up an assignment's blocks and lists each time", () => {
    expect(later.study).toBe("Quiz 5: 1 h 30 min, 8–9 am and 1:05–1:35 pm; Problem set 8: 1 h, 4–5 pm. Each sits in free time before it's due.");
  });

  it("says 1 walk, not 1 walks", () => {
    const one = facts(request, { ...plan, items: plan.items.slice(0, 1) });
    expect(one.walks).toMatch(/^1 walk, 14 minutes on foot in all/);
  });

  it("says 1 class, not 1 classes", () => {
    expect(facts(request, { ...plan, items: plan.items.slice(0, 1) }).schedule).toBe("1 class on Monday: CSE 230.");
  });
});

describe("planFacts on a real setup", () => {
  const request: PlanRequest = {
    date: SAT,
    classes: [{ course: "CSE 230", days: ["Sat"], start: "21:30", end: "22:20", location: "BYENG 210" }],
    deadlines: [],
    events: [],
    interests: ["software", "music"],
    weather: { tempF: 71, highF: 79, isHot: false },
    startBuildingId: "TOOKR",
  };
  const plan = basePlan(SAT, [item(SAT, { id: "c0", type: "class", title: "CSE 230", location: "BYENG 210" }, "21:30", "22:20", "21:21")], {
    weather: request.weather,
  });
  const f = facts(request, plan, false);

  it("does not invent assignments when Canvas sent none", () => {
    expect(f.canvas).toBe("No assignments came back from Canvas for this day. If you haven't connected it yet, add your token in Setup.");
    expect(f.study).toBeUndefined();
  });

  it("names Open-Meteo for the weather", () => {
    expect(f.weather).toBe("Open-Meteo says 71°F now and a high of 79°F.");
  });

  it("starts the walk from the student's own building", () => {
    expect(f.walks).toMatch(/^1 walk, 9 minutes on foot in all, starting from Tooker\./);
  });

  it("says when the event feeds sent nothing", () => {
    expect(f.events).toBe("No events came back from the ASU feeds this time.");
  });

  it("does not claim Gemini ranked events or estimated homework it never saw", () => {
    expect(f.who).toBe("Gemini wrote my words. Plain code did the math: free gaps, walks, heat and where each block goes.");
  });

  it("counts real events this week and on the day, with the interests in chip words", () => {
    const ev = (id: string, startsAt: string): Opportunity => ({
      id,
      kind: "club_event",
      title: id,
      organizer: "",
      description: "",
      url: "",
      startsAt,
      tags: [],
      source: "sundevilcentral",
      fetchedAt: startsAt,
    });
    // 11:30 pm Arizona on Saturday, written in UTC, still counts as Saturday.
    const events = [ev("a", "2026-11-15T06:30:00Z"), ev("b", at(SAT, "18:00")), ev("c", at(MON, "18:00"))];
    const withEvents = facts({ ...request, events }, { ...plan, suggestions: [suggestion(SAT, "A coding night that fits your free evening.")] }, false);
    expect(withEvents.events).toBe(
      "3 events this week from ASU Events and Sun Devil Central, 2 on Saturday. I picked 1 for you. Gemini ranked the ones that fit your free time against your interests: software and music.",
    );
    const elsewhere = facts({ ...request, events: events.slice(2) }, plan, false);
    expect(elsewhere.events).toBe(
      "1 event this week from ASU Events and Sun Devil Central, none on Saturday.",
    );
  });
});

describe("planFacts counts walks the way the map draws them", () => {
  const source = `Each leave time comes from distances between ${buildings.length} ASU buildings from OpenStreetMap.`;
  const request: PlanRequest = { date: MON, classes: [], startBuildingId: "TOOKR" };
  const day = basePlan(MON, [
    item(MON, { id: "c0", type: "class", title: "CSE 230", location: "BYENG 210" }, "10:30", "11:20", "10:20"),
    item(MON, { id: "c1", type: "class", title: "MAT 343", location: "COOR 170" }, "13:30", "14:45", "13:19"),
  ]);

  it("with no start building, counts the walks between classes and names the first one apart", () => {
    expect(facts({ ...request, startBuildingId: undefined }, day, false).walks).toBe(
      `1 walk, 11 minutes on foot in all, plus the walk to your first class. ${source}`,
    );
  });

  it("with a start building, counts every walk from there", () => {
    expect(facts(request, day, false).walks).toMatch(/^2 walks, 21 minutes on foot in all, starting from Tooker\. /);
  });

  it("leaves out a walk to a building the map does not know", () => {
    const unknown = { ...day, items: [...day.items, item(MON, { id: "c2", type: "class", title: "ENG 102", location: "Room 9" }, "16:00", "16:50", "15:50")] };
    expect(facts(request, unknown, false).walks).toMatch(/^2 walks, 21 minutes on foot in all, starting from Tooker\. /);
  });

  it("does not count a walk between two stops in one building", () => {
    const same = {
      ...day,
      items: [day.items[0], item(MON, { id: "c1", type: "class", title: "CSE 240", location: "BYENG 190" }, "11:30", "12:20", "11:27")],
    };
    expect(facts(request, same, false).walks).toMatch(/^1 walk, 10 minutes on foot in all, starting from Tooker\. /);
  });

  it("with only one stop and no start building, counts the plan's own walk", () => {
    const one = { ...day, items: day.items.slice(0, 1) };
    expect(facts({ ...request, startBuildingId: undefined }, one, false).walks).toBe(`1 walk, 10 minutes on foot in all. ${source}`);
  });
});

describe("planFacts on schedules and sample events", () => {
  it("calls a study group a thing, not a class, and keeps a course with a letter a class", () => {
    const { request } = demoScenario(SAT, { today: SAT });
    const day = basePlan(SAT, [
      item(SAT, { id: "a", type: "class", title: "MAT 343 study group", location: "Hayden Library" }, "10:30", "11:45"),
      item(SAT, { id: "b", type: "class", title: "Work shift", location: "Memorial Union" }, "13:30", "16:00"),
    ]);
    expect(facts(request, day).schedule).toBe("2 things on Saturday: your MAT 343 study group and your work shift.");
    const mixed = { ...day, items: [item(SAT, { id: "c", type: "class", title: "BIO 181L", location: "LSE 104" }, "08:30", "09:20"), ...day.items] };
    expect(facts(request, mixed).schedule).toBe("3 things on Saturday: BIO 181L, your MAT 343 study group and your work shift.");
    expect(facts(request, { ...day, items: mixed.items.slice(0, 1) }).schedule).toBe("1 class on Saturday: BIO 181L.");
  });

  it("on a sample day with only live events, does not count zero sample events", () => {
    const { request, plan } = saturday();
    const live: Opportunity = { ...request.events![0], id: "asu-1", source: "asu_events", startsAt: at(MON, "18:00") };
    expect(facts({ ...request, events: [live] }, plan).events).toMatch(
      /^1 event this week from ASU Events and Sun Devil Central, none on Saturday\./,
    );
  });
});

describe("planFacts on special days", () => {
  it("adds walking time on a hot day", () => {
    const { request, plan } = saturday({ weather: { tempF: 101, highF: 107, isHot: true } });
    expect(facts({ ...request, weather: plan.weather }, plan, false).weather).toBe(
      "Open-Meteo says 101°F now and a high of 107°F. It's a hot day, so I added extra minutes to every walk.",
    );
  });

  it("does not credit Open-Meteo for the heat preview", () => {
    const { request, plan } = saturday({ weather: { tempF: 104, highF: 109, isHot: true } });
    expect(facts(request, plan, false).weather).toBe(
      "The heat preview is on, so this is a made-up hot day: 104°F now and a high of 109°F. It's a hot day, so I added extra minutes to every walk.",
    );
  });

  it("says plain rules did everything when Gemini was not reachable", () => {
    const { request, plan } = saturday({
      aiUsed: false,
      suggestions: [suggestion(SAT, "You picked robotics.")],
    });
    const f = facts(request, plan);
    expect(f.who).toBe("Gemini was not reachable, so plain rules did everything, including my words.");
    expect(f.events).toMatch(/Plain rules ranked the ones that fit your free time/);
  });

  it("shows the Atlas step and source only when the day was saved", () => {
    const { request, plan } = saturday();
    expect(facts(request, plan).saved).toBeUndefined();
    expect(planSources(plan).map((s) => s.name)).not.toContain("MongoDB Atlas");

    const saved = { ...plan, calendarUrl: "https://sundial.club/api/plan/x/calendar" };
    expect(facts(request, saved).saved).toBe("This day is saved in MongoDB Atlas, so your calendar app can subscribe to it.");
    expect(planSources(saved).map((s) => s.name)).toContain("MongoDB Atlas");
  });

  it("says when every assignment is turned in, and counts an added event", () => {
    const { request, plan } = saturday();
    const done = { ...request, deadlines: request.deadlines!.map((d) => ({ ...d, done: true })) };
    const added = { ...plan, items: [...plan.items, { ...suggestion(SAT, ""), why: undefined }], suggestions: [] };
    const f = facts(done, added);
    expect(f.canvas).toBe("3 sample assignments: all 3 turned in.");
    expect(f.events).toBe("5 sample events, 5 on Saturday. You added 1. None of the others fits both your free time and your interests.");
  });
});
