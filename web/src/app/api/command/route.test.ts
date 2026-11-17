import { beforeEach, describe, expect, it, vi } from "vitest";

const generateJson = vi.fn();
vi.mock("@/lib/gemini", () => ({ generateJson: (...args: unknown[]) => generateJson(...args) }));

const { POST } = await import("./route");

const plan = {
  items: [
    { id: "class-0-CSE230", type: "class", title: "CSE 230", start: "2026-11-16T10:30:00-07:00", location: "BYENG 210", leaveAt: "2026-11-16T10:20:00-07:00" },
    { id: "study-canvas-quiz-3-1", type: "study_block", title: "Work on: ENG 102: Reading quiz", start: "2026-11-16T11:20:00-07:00" },
    { id: "ev-e9", type: "event", title: "Career fair prep", start: "2026-11-16T17:00:00-07:00" },
  ],
  suggestions: [
    { id: "ev-e1", type: "event", title: "Sun Devil Robotics build night", start: "2026-11-16T16:00:00-07:00" },
    { id: "ev-e2", type: "event", title: "Poetry open mic", start: "2026-11-16T15:00:00-07:00" },
  ],
};

async function command(body: unknown) {
  const res = await POST(new Request("http://test/api/command", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}

beforeEach(() => generateJson.mockReset().mockResolvedValue(null));

describe("POST /api/command with keyword rules (Gemini unavailable)", () => {
  it.each([
    ["How's my day?", { action: "briefing" }],
    ["Add the robotics build night", { action: "add_event", itemId: "ev-e1" }],
    ["join the poetry thing", { action: "add_event", itemId: "ev-e2" }],
    ["drop the study block", { action: "remove_item", itemId: "study-canvas-quiz-3-1" }],
    ["cancel career fair prep", { action: "remove_item", itemId: "ev-e9" }],
  ])("%s", async (text, expected) => {
    expect((await command({ text, plan })).json).toEqual(expected);
  });

  it("hears a curly apostrophe the way phones type it", async () => {
    expect((await command({ text: "How’s my day?", plan })).json).toEqual({ action: "briefing" });
    expect((await command({ text: "what‘s the schedule", plan })).json).toEqual({ action: "briefing" });
  });

  it("skips a class for today only (setup keeps it), and answers unknown with help, never with a question", async () => {
    expect((await command({ text: "drop CSE 230", plan })).json).toEqual({ action: "skip_class", course: "CSE 230" });
    const { json } = await command({ text: "order me a pizza", plan });
    expect(json).toEqual({ action: "unknown", reply: 'I can tell you how your day looks, when to leave, or add an event, like "add the Sun Devil Robotics build night".' });
  });

  it("says what it can add when the event asked for is not among today's picks", async () => {
    const { json } = await command({ text: "add the swimming meeting", plan });
    expect(json).toEqual({
      action: "unknown",
      reply: "I couldn't find a swimming meeting today. I can add the Sun Devil Robotics build night or the poetry open mic.",
    });
    expect((await command({ text: "Add the robotics meeting", plan: { ...plan, suggestions: [] } })).json.reply).toBe(
      "I couldn't find a robotics meeting today. No other event fits your free time.",
    );
  });

  it("answers what is next and when to leave from the plan, as of `now`", async () => {
    const at = (now: string, text = "what's next?") => command({ text, plan, now }).then((r) => r.json);
    expect(await at("2026-11-16T08:00:00-07:00")).toEqual({
      action: "briefing",
      reply: "Next up: CSE 230 at 10:30 am in Brickyard 210. Leave at 10:20 am.",
    });
    expect(await at("2026-11-16T10:25:00-07:00", "when should I leave")).toEqual({
      action: "briefing",
      reply: "Leave now for CSE 230 in Brickyard 210, a 10-minute walk.",
    });
    expect((await at("2026-11-16T11:00:00-07:00", "where do I go now")).reply).toBe("Next up: study time for the Reading quiz for ENG 102 at 11:20 am.");
    expect((await at("2026-11-16T20:00:00-07:00")).reply).toBe("Nothing else is planned today.");
  });

  it("does not call a shuttle ride or the trip from home a walk", async () => {
    const cse = plan.items.find((i) => i.title === "CSE 230")!;
    const ride = (via: string) => ({ ...plan, items: plan.items.map((i) => (i === cse ? { ...i, leaveAt: "2026-11-16T09:15:00-07:00", via } : i)) });
    const ask = (via: string) => command({ text: "when should I leave", plan: ride(via), now: "2026-11-16T08:00:00-07:00" }).then((r) => r.json.reply);
    expect(await ask("From home by car: about 75 minutes, your own estimate.")).toBe(
      "Leave at 9:15 am for CSE 230 in Brickyard 210, a 75-minute trip from home.",
    );
    expect(await ask("Gold shuttle from Forest Avenue and Lemon Street to SIM Building: …")).toBe(
      "Leave at 9:15 am for CSE 230 in Brickyard 210, about 75 minutes with the shuttle.",
    );
  });

  it("names a commitment with 'your' and says which day on a look-ahead", async () => {
    const sunday = {
      items: [
        { id: "class-0", type: "class", title: "MAT 343 study group", start: "2026-11-15T10:30:00-07:00", location: "Hayden Library", leaveAt: "2026-11-15T10:18:00-07:00" },
        { id: "study-r-0", type: "study_block", title: "Work on: ENG 102: Reading response", start: "2026-11-15T11:50:00-07:00" },
        { id: "class-1", type: "class", title: "Work shift", start: "2026-11-15T13:30:00-07:00", location: "Memorial Union", leaveAt: "2026-11-15T13:15:00-07:00" },
      ],
      suggestions: [],
    };
    const ask = (text: string, now: string) => command({ text, plan: sunday, now }).then((r) => r.json.reply);
    expect(await ask("when should I leave?", "2026-11-15T11:00:00-07:00")).toBe(
      "Leave at 1:15 pm for your work shift at the MU, a 15-minute walk. Until then, you have study time for the Reading response for ENG 102 at 11:50 am.",
    );
    expect(await ask("what's next?", "2026-11-15T11:00:00-07:00")).toBe(
      "Next up: study time for the Reading response for ENG 102 at 11:50 am. Then leave at 1:15 pm for your work shift at the MU.",
    );
    expect(await ask("what's next?", "2026-11-15T09:00:00-07:00")).toBe("Next up: your MAT 343 study group at 10:30 am at Hayden. Leave at 10:18 am.");
    // Saturday evening looking at Sunday, and Friday looking at Sunday.
    expect(await ask("when do I leave", "2026-11-14T20:00:00-07:00")).toBe(
      "Tomorrow, leave at 10:18 am for your MAT 343 study group at Hayden, a 12-minute walk.",
    );
    expect(await ask("what's next", "2026-11-13T20:00:00-07:00")).toBe(
      "On Sunday, first up is your MAT 343 study group at 10:30 am at Hayden. Leave at 10:18 am.",
    );
  });

  it("answers a leave question with the walk even when a study block comes first", async () => {
    const morning = {
      ...plan,
      items: [
        { id: "study-a-0", type: "study_block", title: "Work on: ENG 102: Reading response", start: "2026-11-16T09:30:00-07:00" },
        ...plan.items,
      ],
    };
    const ask = (text: string) => command({ text, plan: morning, now: "2026-11-16T08:00:00-07:00" }).then((r) => r.json.reply);
    expect(await ask("When should I leave?")).toBe(
      "Leave at 10:20 am for CSE 230 in Brickyard 210, a 10-minute walk. Until then, you have study time for the Reading response for ENG 102 at 9:30 am.",
    );
    expect(await ask("am I late")).toBe(
      "Leave at 10:20 am for CSE 230 in Brickyard 210, a 10-minute walk. Until then, you have study time for the Reading response for ENG 102 at 9:30 am.",
    );
    expect(await ask("what's next?")).toBe("Next up: study time for the Reading response for ENG 102 at 9:30 am. Then leave at 10:20 am for CSE 230 in Brickyard 210.");
  });

  it("answers 400 for bad bodies and survives a broken plan", async () => {
    expect((await command("nope")).status).toBe(400);
    expect((await command("null")).status).toBe(400);
    expect((await command({ text: "" })).status).toBe(400);
    const res = await command({ text: "add robotics", plan: { items: [null, 5], suggestions: [{ id: "x" }] } });
    expect(res.status).toBe(200);
    expect(res.json.action).toBe("unknown");
  });
});

describe("POST /api/command with Gemini", () => {
  it("uses Gemini's answer and only offers addable and removable items", async () => {
    generateJson.mockResolvedValueOnce({ action: "add_event", itemId: "ev-e2" });
    expect((await command({ text: "the poems one please", plan })).json).toEqual({ action: "add_event", itemId: "ev-e2" });
    const prompt = String(generateJson.mock.calls[0][0]);
    expect(prompt).toContain("ev-e1");
    expect(prompt).toContain("study-canvas-quiz-3-1");
    expect(prompt.split("\n").find((l) => l.startsWith("REMOVABLE:"))).not.toContain("class-0-CSE230"); // classes are skipped, not removed
  });

  it("passes a validator that rejects ids that were not offered", async () => {
    await command({ text: "add robotics", plan });
    const isValid = generateJson.mock.calls[0][2] as (v: unknown) => boolean;
    expect(isValid({ action: "add_event", itemId: "ev-e1" })).toBe(true);
    expect(isValid({ action: "add_event", itemId: "class-0-CSE230" })).toBe(false);
    expect(isValid({ action: "remove_item", itemId: "class-0-CSE230" })).toBe(false);
    expect(isValid({ action: "launch_rockets" })).toBe(false);
    expect(isValid({ action: "next_item" })).toBe(true);
  });

  it("turns Gemini's next_item into a briefing with the computed reply", async () => {
    generateJson.mockResolvedValueOnce({ action: "next_item" });
    const res = await command({ text: "uh where am I supposed to be", plan, now: "2026-11-16T08:00:00-07:00" });
    expect(res.json).toEqual({ action: "briefing", reply: "Next up: CSE 230 at 10:30 am in Brickyard 210. Leave at 10:20 am." });
  });

  it("tells Gemini never to ask a question back, and falls back to the rules when it does", async () => {
    generateJson.mockImplementationOnce(async (...args: unknown[]) => {
      const isValid = args[2] as (v: unknown) => boolean;
      const answer = { action: "unknown", reply: "I couldn't find a robotics meeting. Would you like to add the poetry open mic instead?" };
      return isValid(answer) ? answer : null; // generateJson returns null when isValid rejects
    });
    const { json } = await command({ text: "add the swimming meeting", plan });
    expect(json.reply).not.toContain("?");
    expect(json.reply).toMatch(/^I couldn't find a swimming meeting today\. I can add /);
    const prompt = String(generateJson.mock.calls[0][0]);
    expect(prompt).toMatch(/never ask a question back/i);
    // "Should I go to …?" gets a yes, a reason and how to add it, from the pick's own time (and Sol's reason, when sent).
    expect(prompt).toMatch(/answer "Yes" first/);
    expect(prompt).toMatch(/Never say you are not sure/);
    expect(prompt).toMatch(/"id":"ev-e2","title":"Poetry open mic","time":"3:00\sPM"/);
    const isValid = generateJson.mock.calls[0][2] as (v: unknown) => boolean;
    expect(isValid({ action: "unknown", reply: "I can add the poetry open mic." })).toBe(true);
  });

  it("drops a named study block by the keyword rule, without asking Gemini (its 'none here' answer got cached)", async () => {
    generateJson.mockResolvedValue({ action: "unknown", reply: "I couldn't find a study block to drop today." });
    expect((await command({ text: "drop the study block", plan })).json).toEqual({ action: "remove_item", itemId: "study-canvas-quiz-3-1" });
    expect((await command({ text: "Study time at 11, skip it", plan })).json).toEqual({ action: "remove_item", itemId: "study-canvas-quiz-3-1" });
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("adds a pick the student clearly named even when Gemini says it can't find it, but answers questions", async () => {
    generateJson.mockResolvedValue({ action: "unknown", reply: "I couldn't find a robotics meeting today." });
    expect((await command({ text: "add the robotics meeting", plan })).json).toEqual({ action: "add_event", itemId: "ev-e1" });
    generateJson.mockResolvedValue({ action: "unknown", reply: "Yes: it's at 3 pm and it's about poetry. Say add the open mic." });
    expect((await command({ text: "should I go to the poetry open mic?", plan })).json).toEqual({
      action: "unknown",
      reply: "Yes: it's at 3 pm and it's about poetry. Say add the open mic.",
    });
    // Not for removals: "cancel the study group" must not remove a study block.
    generateJson.mockResolvedValue({ action: "unknown", reply: "Your study group is a commitment, so I can't take it off." });
    expect((await command({ text: "cancel the study group", plan })).json.action).toBe("unknown");
  });

  it("still asks Gemini about a study group, which is not a study block", async () => {
    generateJson.mockResolvedValueOnce({ action: "unknown", reply: "Your MAT 343 study group is a commitment, so I can't take it off." });
    const { json } = await command({ text: "cancel the study group", plan });
    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(json.action).toBe("unknown");
  });

  it("asks Gemini when no study block is left to drop", async () => {
    const noStudy = { ...plan, items: plan.items.filter((i) => i.type !== "study_block") };
    await command({ text: "drop the study block", plan: noStudy });
    expect(generateJson).toHaveBeenCalledTimes(1);
  });
});

describe("Sol's chat: chips, answers from the day's facts, and memory", () => {
  const day = {
    date: "2026-11-16",
    weather: { tempF: 97, highF: 101, isHot: true },
    deadlines: [
      { id: "canvas-assignment-1", type: "deadline", title: "CSE 230: Lab 7", start: "2026-11-16T23:59:00-07:00", source: "canvas", done: false },
      { id: "canvas-assignment-2", type: "deadline", title: "MAT 343: HW 9", start: "2026-11-16T17:00:00-07:00", source: "canvas", done: true },
    ],
  };
  const at = "2026-11-16T08:00:00-07:00";

  it("answers the chips in code, without Gemini", async () => {
    const ask = (text: string) => command({ text, plan, now: at, ...day }).then((r) => r.json);
    expect(await ask("What's due?")).toEqual({
      action: "briefing",
      reply: "Lab 7 for CSE 230 is due today at 11:59 pm. HW 9 for MAT 343 is already turned in.",
    });
    expect((await ask("how hot is it")).reply).toBe("It's 97°F now with a high of 101°F. It's a hot day: take water, and I've added time to your walks.");
    expect((await ask("Do I have free time?")).reply).toMatch(/^You're free 8 am to 10:20 am \(2 h 20 min\)/);
    expect((await ask("When should I leave?")).reply).toBe("Leave at 10:20 am for CSE 230 in Brickyard 210, a 10-minute walk.");
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("gives Gemini the day's facts and the chat so far, and passes its answer on", async () => {
    generateJson.mockResolvedValueOnce({ action: "answer", reply: "Yes: you're free until 10:20 AM, so there's time for breakfast." });
    const history = [
      { from: "you", text: "What's next?" },
      { from: "sol", text: "Next up: CSE 230 at 10:30 am." },
    ];
    const { json } = await command({ text: "do I have time to eat first", plan, now: at, history, ...day });
    expect(json).toEqual({ action: "briefing", reply: "Yes: you're free until 10:20 am, so there's time for breakfast." });
    const prompt = generateJson.mock.calls[0][0] as string;
    expect(prompt).toContain("10:30 am to");
    expect(prompt).toContain("Lab 7 for CSE 230: due today at 11:59 pm, not turned in yet.");
    expect(prompt).toContain("WEATHER: 97°F now, high 101°F, a hot day.");
    expect(prompt).toContain('"Sol: Next up: CSE 230 at 10:30 am."');
  });

  it("does not let Gemini invent a time: such an answer is rejected and the rules answer", async () => {
    generateJson.mockResolvedValueOnce(null);
    await command({ text: "when is my lab due", plan, now: at, ...day });
    const isValid = generateJson.mock.calls[0][2] as (v: unknown) => boolean;
    expect(isValid({ action: "answer", reply: "Lab 7 is due at 11:59 PM tonight." })).toBe(true);
    expect(isValid({ action: "answer", reply: "Lab 7 is due at 9 pm." })).toBe(false);
    expect(isValid({ action: "answer", reply: "Want me to add study time?" })).toBe(false);
    // With Gemini out, "when is my lab due" still gets the deadlines from code.
    expect((await command({ text: "when is my lab due", plan, now: at, ...day })).json.reply).toContain("Lab 7 for CSE 230 is due today at 11:59 pm.");
  });

  it("answers where to get help in code: tutoring that is open while the student is free", async () => {
    const essay = { id: "canvas-assignment-3", type: "deadline", title: "ENG 102: Reading response", start: "2026-11-17T12:00:00-07:00", source: "canvas", done: false };
    const withEssay = { ...day, deadlines: [...day.deadlines, essay] };
    const ask = (text: string) => command({ text, plan, now: at, ...withEssay }).then((r) => r.json.reply);
    // Noble's Writing Center is open 10 to 5: the longest free stretch in it is after CSE 230 (and the walk) until
    // the walk to the 5 pm event.
    const writing = "For the Reading response for ENG 102, try the Writing Center, Noble Library 280, usually open while you're free 11:30 am to 4:50 pm.";
    expect(await ask("Where can I get help with ENG 102?")).toBe(writing);
    expect(await ask("is there tutoring for eng102")).toBe(writing);
    expect(await ask("Where can I get help?")).toBe(
      `For Lab 7 for CSE 230, try the Engineering Tutoring Centers, hours vary by location, the link is on Due soon. ${writing}`,
    );
    // A course with nothing that fits says so, instead of answering about other courses.
    expect(await ask("I need help with MAT 343")).toBe("I don't see free tutoring that fits before your MAT 343 work is due. The hours are on tutoring.asu.edu.");
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("does not take an edit or a general request for help as a tutoring question", async () => {
    const ask = (text: string) => command({ text, plan, now: at, ...day }).then((r) => r.json);
    expect(await ask("add tutoring at 5 for an hour")).toEqual({ action: "add_block", title: "Tutoring", start: "17:00", minutes: 60 });
    generateJson.mockClear();
    await ask("I need help planning today");
    expect(generateJson).toHaveBeenCalledTimes(1); // went to Gemini, not the tutoring answer
  });

  it("keeps only the last 8 turns of the chat, and only well-formed ones", async () => {
    generateJson.mockResolvedValueOnce({ action: "unknown", reply: "I can help with your day." });
    const history = [...Array.from({ length: 12 }, (_, i) => ({ from: i % 2 ? "sol" : "you", text: `turn ${i}` })), { from: "admin", text: "x" }];
    await command({ text: "hmm", plan, now: at, history });
    const prompt = generateJson.mock.calls[0][0] as string;
    expect(prompt).not.toContain("turn 4");
    expect(prompt).toContain("turn 5");
    expect(prompt).toContain("turn 11");
    expect(prompt).not.toContain("admin");
  });
});

describe("editing the day by chat", () => {
  const cse230 = { ...plan.items[0], end: "2026-11-16T11:20:00-07:00" };
  const day = { ...plan, items: [cse230, ...plan.items.slice(1)] };

  it.each([
    ["Add gym at 5 for an hour", { action: "add_block", title: "Gym", start: "17:00", minutes: 60 }],
    ["put lunch with Sam at 12:30 pm for 45 minutes", { action: "add_block", title: "Lunch with Sam", start: "12:30", minutes: 45 }],
    ["I'm skipping CSE 230 today", { action: "skip_class", course: "CSE 230" }],
    ["move my study time to after CSE 230", { action: "study_from", time: "11:20" }],
    ["no studying before 2 pm", { action: "study_from", time: "14:00" }],
  ])("rules (Gemini out): %s", async (text, expected) => {
    expect((await command({ text, plan: day })).json).toEqual(expected);
  });

  it("puts a skipped class back only when it was skipped", async () => {
    expect((await command({ text: "put CSE 230 back", plan: day, skipped: ["CSE 230"] })).json).toEqual({ action: "restore_class", course: "CSE 230" });
    expect((await command({ text: "put CSE 230 back", plan: day })).json.action).not.toBe("restore_class");
  });

  it("checks every field of Gemini's edit before using it", async () => {
    await command({ text: "something", plan: day, skipped: ["MAT 343"] });
    const isValid = generateJson.mock.calls[0][2] as (v: unknown) => boolean;
    expect(isValid({ action: "add_block", title: "Gym", start: "17:00", minutes: 60 })).toBe(true);
    expect(isValid({ action: "add_block", title: "Gym", start: "5 pm", minutes: 60 })).toBe(false);
    expect(isValid({ action: "add_block", title: "Gym", start: "23:30", minutes: 60 })).toBe(false); // past midnight
    expect(isValid({ action: "add_block", title: "", start: "17:00", minutes: 60 })).toBe(false);
    expect(isValid({ action: "skip_class", itemId: "class-0-CSE230" })).toBe(true);
    expect(isValid({ action: "skip_class", itemId: "ev-e9" })).toBe(false); // an event is removed, not skipped
    expect(isValid({ action: "restore_class", course: "mat 343" })).toBe(true);
    expect(isValid({ action: "restore_class", course: "PHY 121" })).toBe(false);
    expect(isValid({ action: "study_from", itemId: "class-0-CSE230" })).toBe(true);
    expect(isValid({ action: "study_from", time: "25:00" })).toBe(false);
  });

  it("turns Gemini's edit into the action the app applies", async () => {
    generateJson.mockResolvedValueOnce({ action: "skip_class", itemId: "class-0-CSE230" });
    expect((await command({ text: "not going to computer org today", plan: day })).json).toEqual({ action: "skip_class", course: "CSE 230" });
    generateJson.mockResolvedValueOnce({ action: "study_from", itemId: "class-0-CSE230" });
    expect((await command({ text: "push homework past my morning class", plan: day })).json).toEqual({ action: "study_from", time: "11:20" });
    generateJson.mockResolvedValueOnce({ action: "add_block", title: "Gym", start: "17:00", minutes: 90, location: "SDFC" });
    expect((await command({ text: "gym 5 to 6:30 at the SDFC", plan: day })).json).toEqual({
      action: "add_block",
      title: "Gym",
      start: "17:00",
      minutes: 90,
      location: "SDFC",
    });
  });
});

describe("a coming day the student picked (it is Monday, the day on screen is Wednesday)", () => {
  const wed = (hhmm: string) => `2026-11-18T${hhmm}:00-07:00`;
  const wednesday = {
    items: [
      { id: "study-q-0", type: "study_block", title: "Work on: CSE 240: Quiz 5", start: wed("08:00"), end: wed("08:30") },
      { id: "class-0", type: "class", title: "CSE 230", start: wed("10:30"), end: wed("11:20"), location: "BYENG 210", leaveAt: wed("10:13") },
    ],
    suggestions: [],
  };
  const context = {
    now: "2026-11-16T21:00:00-07:00",
    date: "2026-11-18",
    weather: { tempF: 70, highF: 84, isHot: false },
    deadlines: [{ id: "canvas-assignment-4", type: "deadline", title: "CSE 240: Quiz 5", start: wed("23:59"), source: "canvas", done: false }],
  };
  const ask = (text: string, plan = wednesday) => command({ text, plan, ...context }).then((r) => r.json.reply);

  it("answers in code about Wednesday, not today", async () => {
    expect(await ask("What's due?")).toBe("Quiz 5 for CSE 240 is due Wednesday at 11:59 pm.");
    expect(await ask("How hot is it?")).toBe("On Wednesday, the high is 84°F.");
    expect(await ask("Do I have free time?")).toMatch(/^On Wednesday, you're free 8:30 am to 10:13 am/);
    expect(await ask("What's next?")).toBe("On Wednesday, first up is study time for Quiz 5 for CSE 240 at 8 am. Then leave at 10:13 am for CSE 230 in Brickyard 210.");
    expect(await ask("What's next?", { items: [], suggestions: [] })).toBe("On Wednesday, nothing is planned.");
  });

  it("tells Gemini the day is a coming one and to name it", async () => {
    await ask("do I have time for lunch");
    const prompt = generateJson.mock.calls[0][0] as string;
    expect(prompt).toContain("DAY: Wednesday, November 18, a coming day (today is Monday, November 16).");
    expect(prompt).toContain('answer about it and name it ("On Wednesday, …", "Tomorrow, …")');
    expect(prompt).not.toContain("NOW:");
  });

  it("still answers where a class is and what is on in the morning when Gemini is out", async () => {
    expect(await ask("where is CSE 230?")).toBe("On Wednesday, CSE 230 is at 10:30 am in Brickyard 210. Leave at 10:13 am.");
    expect(await ask("what do I have in the morning")).toBe(
      "On Wednesday morning, you have study time for Quiz 5 for CSE 240 at 8 am and CSE 230 at 10:30 am in Brickyard 210.",
    );
  });
});
