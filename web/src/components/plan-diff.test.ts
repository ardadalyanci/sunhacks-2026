import { describe, expect, it } from "vitest";
import type { DayItem, DayPlan } from "@/lib/types";
import { describeChange, diffPlans } from "./plan-diff";

const at = (hhmm: string) => `2026-11-16T${hhmm}:00-07:00`;
const cls = (title: string, start: string, end: string, leave: string, location: string): DayItem => ({
  id: `class-${title}`,
  type: "class",
  title,
  start: at(start),
  end: at(end),
  leaveAt: at(leave),
  location,
  source: "manual",
});
const study = (id: string, assignment: string, start: string, end: string): DayItem => ({
  id,
  type: "study_block",
  title: `Work on: ${assignment}`,
  start: at(start),
  end: at(end),
  source: "planner",
});
const deadline = (title: string, due: string): DayItem => ({ id: `dl-${title}`, type: "deadline", title, start: due, source: "canvas" });
const plan = (...items: DayItem[]): DayPlan => ({
  date: "2026-11-16",
  items: [...items].sort((a, b) => a.start.localeCompare(b.start)),
  suggestions: [],
  briefing: "",
  aiUsed: false,
});

const LAB = "CSE 230: Lab 7 (pipelining)";
const READING = "ENG 102: Reading response";
const PSET = "PHY 121: Problem set 8";
const mu = cls("Work shift", "10:00", "14:00", "09:47", "Memorial Union");
const cse240 = cls("CSE 240", "15:00", "15:50", "14:52", "BYENG 190");
const labDue = deadline(LAB, at("23:59"));

describe("diffPlans", () => {
  it("finds added, removed and moved items and changed leave times", () => {
    const robotics: DayItem = { id: "ev-demo-robotics", type: "event", title: "Robotics club build night", start: at("16:15"), end: at("17:30"), leaveAt: at("16:10"), location: "Memorial Union 230", source: "asu_events" };
    const before = plan(mu, cse240, labDue, study("study-a-0", LAB, "08:00", "09:00"));
    const after = plan({ ...mu, leaveAt: at("09:45") }, labDue, robotics, study("study-a-3", LAB, "16:00", "17:00"));
    const diff = diffPlans(before, after);
    expect(diff.added.map((i) => i.title)).toEqual(["Robotics club build night"]);
    expect(diff.removed.map((i) => i.title)).toEqual(["CSE 240"]);
    expect(diff.leave).toEqual([{ item: expect.objectContaining({ title: "Work shift" }), before: at("09:47"), after: at("09:45") }]);
    expect(diff.moved).toEqual([
      { type: "study_block", title: `Work on: ${LAB}`, before: [{ start: at("08:00"), end: at("09:00") }], after: [{ start: at("16:00"), end: at("17:00") }] },
    ]);
  });

  it("ignores renumbered study block ids when the times stay", () => {
    const before = plan(mu, study("study-a-0", LAB, "08:00", "09:00"));
    const after = plan(mu, study("study-a-7", LAB, "08:00", "09:00"));
    expect(diffPlans(before, after)).toEqual({ added: [], removed: [], moved: [], leave: [] });
  });
});

describe("describeChange", () => {
  it("heat on: every walk earlier, and the next leave time", () => {
    const before = plan(mu, cse240, labDue);
    const after = plan({ ...mu, leaveAt: at("09:45") }, { ...cse240, leaveAt: at("14:50") }, labDue);
    expect(describeChange({ kind: "hot", on: true, hotF: 104, realF: 78 }, before, after, { now: at("08:00") })).toBe(
      "104° out, so I start every walk 2 minutes earlier. You now leave at 9:45 am for the MU.",
    );
  });

  it("heat: a study block cut short by the earlier walk says where it stops now", () => {
    const before = plan(mu, study("s0", READING, "09:00", "09:47"));
    const after = plan({ ...mu, leaveAt: at("09:45") }, study("s0", READING, "09:00", "09:45"));
    expect(describeChange({ kind: "hot", on: true, hotF: 104, realF: 78 }, before, after, { now: at("08:00") })).toBe(
      "104° out, so I start every walk 2 minutes earlier. You now leave at 9:45 am for the MU, and I stop the Reading response at 9:45 am.",
    );
    expect(describeChange({ kind: "hot", on: false, hotF: 104, realF: 78 }, after, before, { now: at("08:00") })).toBe(
      "Back to 78°: your walks are 2 minutes later again. I let the Reading response run to 9:47 am.",
    );
  });

  it("heat off: what went back", () => {
    const hot = plan({ ...mu, leaveAt: at("09:45") }, { ...cse240, leaveAt: at("14:50") });
    const cool = plan(mu, cse240);
    expect(describeChange({ kind: "hot", on: false, hotF: 104, realF: 78 }, hot, cool, { now: at("08:00") })).toBe(
      "Back to 78°: your walks are 2 minutes later again.",
    );
  });

  it("overslept: a study block moved, and the walk that did not", () => {
    const before = plan(mu, labDue, study("s0", LAB, "08:00", "09:13"));
    const after = plan(mu, labDue, study("s0", LAB, "14:00", "15:13"));
    const cause = { kind: "overslept", on: true, from: at("08:00"), to: at("09:00") } as const;
    expect(describeChange(cause, before, after, { now: at("09:00") })).toBe(
      "Up at 9 am instead of 8 am: I moved Lab 7 to 2–3:13 pm. You still leave at 9:47 am for the MU.",
    );
  });

  it("overslept: a study block that no longer fits names its due time", () => {
    const before = plan(mu, study("s0", READING, "08:00", "09:00"));
    const after = plan(mu);
    const cause = { kind: "overslept", on: true, from: at("08:00"), to: at("09:00") } as const;
    const deadlines = [deadline(READING, at("12:00"))];
    expect(describeChange(cause, before, after, { now: at("09:00"), deadlines })).toBe(
      "Up at 9 am instead of 8 am: there's no room left for the Reading response before it's due at noon. You still leave at 9:47 am for the MU.",
    );
    const tomorrow = [deadline(READING, "2026-11-17T12:00:00-07:00")];
    expect(describeChange(cause, before, after, { now: at("13:00"), deadlines: tomorrow })).toBe(
      "Up at 9 am instead of 8 am: there's no room left for the Reading response before it's due at noon tomorrow.",
    );
  });

  it("cancelled: names the freed time and what went there", () => {
    const before = plan(mu, cse240);
    const after = plan(mu, study("s1", PSET, "15:00", "15:50"));
    expect(describeChange({ kind: "skip", on: true, course: "CSE 240" }, before, after, { now: at("08:00") })).toBe(
      "No CSE 240 today: that frees 3–3:50 pm, and I put Problem set 8 there.",
    );
  });

  it("event added: its time and walk, and that nothing else moved", () => {
    const robotics: DayItem = { id: "ev-demo-robotics", type: "event", title: "Robotics club build night", start: at("16:15"), end: at("17:30"), leaveAt: at("16:10"), location: "Memorial Union 230", source: "asu_events" };
    expect(describeChange({ kind: "added", id: robotics.id }, plan(mu), plan(mu, robotics))).toBe(
      "Added Robotics club build night, 4:15–5:30 pm, so leave at 4:10 pm for the MU 230. Nothing else moved.",
    );
    expect(describeChange({ kind: "removed", id: robotics.id }, plan(mu, robotics), plan(mu))).toBe(
      "Took Robotics club build night off your day. Nothing else moved.",
    );
  });

  it("event added: says which study block made room", () => {
    const robotics: DayItem = { id: "ev-r", type: "event", title: "Robotics club build night", start: at("16:15"), end: at("17:30"), leaveAt: at("16:10"), location: "Memorial Union 230", source: "asu_events" };
    const before = plan(mu, study("s0", LAB, "16:00", "17:00"));
    const after = plan(mu, robotics, study("s0", LAB, "17:30", "18:30"));
    expect(describeChange({ kind: "added", id: robotics.id }, before, after)).toBe(
      "Added Robotics club build night, 4:15–5:30 pm, so leave at 4:10 pm for the MU 230. I moved Lab 7 to 5:30–6:30 pm.",
    );
  });

  it("says so when nothing had to move", () => {
    const day = plan(mu, labDue);
    const cause = { kind: "overslept", on: true, from: at("08:00"), to: at("09:00") } as const;
    expect(describeChange(cause, day, day, { now: at("09:00") })).toBe(
      "Up at 9 am instead of 8 am: nothing had to move. You still leave at 9:47 am for the MU.",
    );
    expect(describeChange({ kind: "hot", on: true, hotF: 104 }, plan(labDue), plan(labDue))).toBe(
      "It's 104° now. Nothing had to move.",
    );
  });

  it("keeps to two sentences", () => {
    const before = plan(mu, study("a", LAB, "08:00", "09:00"), study("b", READING, "16:00", "17:00"), study("c", PSET, "17:00", "18:00"));
    const after = plan(mu, study("a", LAB, "14:00", "15:00"), study("b", READING, "17:00", "18:00"));
    const cause = { kind: "overslept", on: true, from: at("08:00"), to: at("09:00") } as const;
    const text = describeChange(cause, before, after, { now: at("09:00") });
    expect(text.split(". ").length).toBeLessThanOrEqual(2);
    expect(text).not.toMatch(/[!—]/);
  });
});
