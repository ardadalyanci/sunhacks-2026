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

  it("never removes classes and answers unknown with help, never with a question", async () => {
    expect((await command({ text: "drop CSE 230", plan })).json.action).toBe("unknown");
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
    expect((await at("2026-11-16T11:00:00-07:00", "where do I go now")).reply).toBe("Next up: the Reading quiz for ENG 102 at 11:20 am.");
    expect((await at("2026-11-16T20:00:00-07:00")).reply).toBe("Nothing else is planned today.");
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
      "Leave at 1:15 pm for your work shift at the MU, a 15-minute walk. Until then, you're on the Reading response for ENG 102 at 11:50 am.",
    );
    expect(await ask("what's next?", "2026-11-15T11:00:00-07:00")).toBe(
      "Next up: the Reading response for ENG 102 at 11:50 am. Then leave at 1:15 pm for your work shift at the MU.",
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
      "Leave at 10:20 am for CSE 230 in Brickyard 210, a 10-minute walk. Until then, you're on the Reading response for ENG 102 at 9:30 am.",
    );
    expect(await ask("am I late")).toBe(
      "Leave at 10:20 am for CSE 230 in Brickyard 210, a 10-minute walk. Until then, you're on the Reading response for ENG 102 at 9:30 am.",
    );
    expect(await ask("what's next?")).toBe("Next up: the Reading response for ENG 102 at 9:30 am. Then leave at 10:20 am for CSE 230 in Brickyard 210.");
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
    expect(prompt).not.toContain("class-0-CSE230");
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
    const isValid = generateJson.mock.calls[0][2] as (v: unknown) => boolean;
    expect(isValid({ action: "unknown", reply: "I can add the poetry open mic." })).toBe(true);
  });

  it("drops a named study block by the keyword rule, without asking Gemini (its 'none here' answer got cached)", async () => {
    generateJson.mockResolvedValue({ action: "unknown", reply: "I couldn't find a study block to drop today." });
    expect((await command({ text: "drop the study block", plan })).json).toEqual({ action: "remove_item", itemId: "study-canvas-quiz-3-1" });
    expect((await command({ text: "Study time at 11, skip it", plan })).json).toEqual({ action: "remove_item", itemId: "study-canvas-quiz-3-1" });
    expect(generateJson).not.toHaveBeenCalled();
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
