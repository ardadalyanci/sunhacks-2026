import { beforeEach, describe, expect, it, vi } from "vitest";

const generateJson = vi.fn();
vi.mock("@/lib/gemini", () => ({ generateJson: (...args: unknown[]) => generateJson(...args) }));

const { POST } = await import("./route");

const plan = {
  items: [
    { id: "class-0-CSE230", type: "class", title: "CSE 230", start: "2026-11-16T10:30:00-07:00" },
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
    ["what is next today", { action: "briefing" }],
    ["Add the robotics build night", { action: "add_event", itemId: "ev-e1" }],
    ["join the poetry thing", { action: "add_event", itemId: "ev-e2" }],
    ["drop the study block", { action: "remove_item", itemId: "study-canvas-quiz-3-1" }],
    ["cancel career fair prep", { action: "remove_item", itemId: "ev-e9" }],
  ])("%s", async (text, expected) => {
    expect((await command({ text, plan })).json).toEqual(expected);
  });

  it("never removes classes and answers unknown with help", async () => {
    expect((await command({ text: "drop CSE 230", plan })).json.action).toBe("unknown");
    expect((await command({ text: "order me a pizza", plan })).json).toEqual({ action: "unknown", reply: expect.stringContaining("How's my day") });
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
  });
});
