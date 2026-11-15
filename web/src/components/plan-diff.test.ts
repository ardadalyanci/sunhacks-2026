import { describe, expect, it } from "vitest";
import type { DayItem, DayPlan } from "@/lib/types";
import { describeChange, describeRemovedStudy, describeStack, diffPlans } from "./plan-diff";

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

  it("cancelled: gives the real times when the study block is not inside the freed time", () => {
    const before = plan(cse240, study("s0", READING, "16:00", "16:45"));
    const after = plan(study("s0", READING, "14:30", "15:15"));
    expect(describeChange({ kind: "skip", on: true, course: "CSE 240" }, before, after, { now: at("08:00") })).toBe(
      "No CSE 240 today: that frees 3–3:50 pm, so I put the Reading response at 2:30–3:15 pm.",
    );
  });

  it("never says \"I moved\" twice in one note", () => {
    const before = plan(mu, study("a", LAB, "08:00", "09:00"), study("b", READING, "09:00", "09:45"));
    const after = plan(mu, study("a", LAB, "09:00", "09:40"), study("a2", LAB, "14:00", "14:30"), study("b", READING, "16:25", "17:10"));
    const cause = { kind: "overslept", on: true, from: at("08:00"), to: at("09:00") } as const;
    expect(describeChange(cause, before, after, { now: at("09:00") })).toBe(
      "Up at 9 am instead of 8 am: I moved Lab 7 to 9–9:40 am and 2–2:30 pm. The Reading response slides to 4:25–5:10 pm.",
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

describe("describeStack", () => {
  const GROUP = "MAT 343 study group";
  const group = cls(GROUP, "10:30", "11:45", "10:20", "Memorial Union");
  const psy = cls("PSY 101", "13:30", "14:45", "13:17", "Memorial Union");
  const base = plan(group, psy, study("a", LAB, "08:00", "09:30"), study("b", READING, "16:00", "16:45"));
  const hotPsy = { ...psy, leaveAt: at("13:15") };

  it("names every pill that is on, the next walk and what moved against the day with no pills", () => {
    const after = plan(hotPsy, study("a", LAB, "10:30", "11:45"), study("b", READING, "16:00", "16:45"));
    const stack = { hotF: 104, wakeAt: at("09:00"), skipped: GROUP };
    expect(describeStack(stack, base, after, { now: at("09:00") })).toBe(
      "104°, up at 9 am and no MAT 343 study group: you leave at 1:15 pm for the MU. Lab 7 is now 10:30–11:45 am.",
    );
  });

  it("reads right with two pills, whichever came last", () => {
    const after = plan({ ...group, leaveAt: at("10:18") }, hotPsy, study("a", LAB, "09:00", "10:10"), study("b", READING, "16:00", "16:45"));
    expect(describeStack({ hotF: 104, wakeAt: at("09:00") }, base, after, { now: at("09:00") })).toBe(
      "104° and up at 9 am: you leave at 10:18 am for the MU, 2 minutes earlier for the heat. Lab 7 is now 9–10:10 am.",
    );
    const noGroup = plan(psy, study("a", LAB, "08:00", "09:30"), study("b", READING, "16:00", "16:45"));
    expect(describeStack({ wakeAt: at("09:00"), skipped: GROUP }, base, noGroup, { now: at("09:00") })).toBe(
      "Up at 9 am and no MAT 343 study group: you still leave at 1:17 pm for the MU. Nothing else moved.",
    );
  });

  it("says what no longer fits, each thing once", () => {
    const after = plan(hotPsy, study("a", LAB, "10:30", "11:45"));
    const text = describeStack({ hotF: 104, skipped: GROUP }, base, after, { now: at("08:00") });
    expect(text).toBe(
      "104° and no MAT 343 study group: you leave at 1:15 pm for the MU. Lab 7 is now 10:30–11:45 am and there's no room left for the Reading response.",
    );
    expect(text.match(/Lab 7/g)).toHaveLength(1);
  });
});

describe("describeRemovedStudy", () => {
  it("names the assignment and the times, in words that read well aloud", () => {
    expect(describeRemovedStudy([study("a", LAB, "08:00", "10:00")])).toBe("Removed the Lab 7 study block, 8 to 10 am.");
    expect(describeRemovedStudy([study("a", READING, "09:00", "10:16"), study("b", READING, "13:50", "14:23")])).toBe(
      "Removed the Reading response study blocks, 9 to 10:16 am and 1:50 to 2:23 pm.",
    );
  });
});
