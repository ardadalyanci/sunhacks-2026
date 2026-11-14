import { beforeEach, describe, expect, it, vi } from "vitest";

const generateJson = vi.fn();
vi.mock("@/lib/gemini", () => ({ generateJson: (...args: unknown[]) => generateJson(...args) }));

const { POST } = await import("./route");

// The exact body B's components/commands.ts sends: { transcript, items, picks (CampusEvent[]) }, plus briefing/now.
const items = [
  { id: "leave-class-0-CSE230", kind: "leave", title: "Leave for BYENG", startsAt: "2026-11-16T10:14:00-07:00", forItemId: "class-0-CSE230" },
  { id: "class-0-CSE230", kind: "class", title: "CSE 230", startsAt: "2026-11-16T10:30:00-07:00", endsAt: "2026-11-16T11:20:00-07:00" },
  { id: "study-canvas-quiz-3-1", kind: "study", title: "Work on Reading quiz", startsAt: "2026-11-16T11:20:00-07:00", endsAt: "2026-11-16T12:00:00-07:00" },
  { id: "event-e9", kind: "event", title: "Career fair prep", startsAt: "2026-11-16T17:00:00-07:00" },
];
const picks = [
  { id: "e1", title: "Sun Devil Robotics build night", startsAt: "2026-11-16T16:00:00-07:00", url: "https://x.test", source: "sun_devil_central", interests: [] },
  { id: "e2", title: "Poetry open mic", startsAt: "2026-11-16T15:00:00-07:00", url: "https://x.test", source: "asu_events", interests: [] },
];
const base = { items, picks, briefing: "Morning! Three classes today.", now: "2026-11-16T09:00:00-07:00" };

async function command(body: unknown) {
  const res = await POST(new Request("http://test/api/command", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}

beforeEach(() => generateJson.mockReset().mockResolvedValue(null));

describe("POST /api/command with keyword rules (Gemini unavailable)", () => {
  it.each([
    ["How's my day?", { action: "briefing", say: "Morning! Three classes today." }],
    ["what's next", { action: "next_item", id: "class-0-CSE230", say: "Next: CSE 230 at 10:30 AM. Leave at 10:14 AM." }],
    ["Add the robotics build night", { action: "add_event", id: "e1", say: "Added Sun Devil Robotics build night at 4:00 PM." }],
    ["join the poetry thing", { action: "add_event", id: "e2", say: "Added Poetry open mic at 3:00 PM." }],
    ["drop the study block", { action: "remove_item", id: "study-canvas-quiz-3-1", say: "Removed Work on Reading quiz from your day." }],
    ["cancel career fair prep", { action: "remove_item", id: "event-e9", say: "Removed Career fair prep from your day." }],
  ])("%s", async (transcript, expected) => {
    expect((await command({ ...base, transcript })).json).toEqual(expected);
  });

  it("accepts EventPick entries as picks, and `text` instead of `transcript`", async () => {
    const res = await command({ ...base, picks: picks.map((event) => ({ event, score: 0.9, why: "" })), text: "add robotics" });
    expect(res.json).toMatchObject({ action: "add_event", id: "e1" });
  });

  it("never removes classes, says when nothing is next, and answers none with help", async () => {
    expect((await command({ ...base, transcript: "drop CSE 230" })).json.action).toBe("none");
    expect((await command({ ...base, transcript: "what's next", now: "2026-11-16T23:00:00-07:00" })).json).toEqual({ action: "next_item", say: "Nothing else is planned today." });
    expect((await command({ ...base, transcript: "order me a pizza" })).json).toEqual({ action: "none", say: expect.stringContaining("add the robotics meeting") });
  });

  it("speaks a summary of the timeline when the client sends no briefing", async () => {
    const withDue = [...items, { id: "a1", kind: "assignment", title: "Lab 7", dueAt: "2026-11-16T23:59:00-07:00", submitted: false }];
    const res = await command({ transcript: "how's my day", items: withDue, picks });
    expect(res.json).toEqual({ action: "briefing", say: "You have 1 class today. First up is CSE 230 at 10:30 AM; leave at 10:14 AM. Lab 7 is due at 11:59 PM." });
  });

  it("does not offer an event that is already on the day", async () => {
    const res = await command({ ...base, items: [...items, { id: "event-e1", kind: "event", title: "Sun Devil Robotics build night", startsAt: "2026-11-16T16:00:00-07:00" }], transcript: "add robotics" });
    expect(res.json).toEqual({ action: "none", say: "Sun Devil Robotics build night is already on your day." });
  });

  it("answers 400 for bad bodies and survives broken lists", async () => {
    expect((await command("nope")).status).toBe(400);
    expect((await command("null")).status).toBe(400);
    expect((await command({ items, picks })).status).toBe(400);
    const res = await command({ transcript: "add robotics", items: [null, 5], picks: [{ id: "x" }] });
    expect(res.status).toBe(200);
    expect(res.json.action).toBe("none");
  });
});

describe("POST /api/command with Gemini", () => {
  it("uses Gemini's decision and only offers addable and removable items", async () => {
    generateJson.mockResolvedValueOnce({ action: "add_event", id: "e2" });
    expect((await command({ ...base, transcript: "the poems one please" })).json).toEqual({ action: "add_event", id: "e2", say: "Added Poetry open mic at 3:00 PM." });
    const prompt = String(generateJson.mock.calls[0][0]);
    expect(prompt).toContain('"e1"');
    expect(prompt).toContain("study-canvas-quiz-3-1");
    expect(prompt).not.toContain("class-0-CSE230");
  });

  it("passes a validator that rejects ids that were not offered", async () => {
    await command({ ...base, transcript: "add robotics" });
    const isValid = generateJson.mock.calls[0][2] as (v: unknown) => boolean;
    expect(isValid({ action: "add_event", id: "e1" })).toBe(true);
    expect(isValid({ action: "add_event", id: "class-0-CSE230" })).toBe(false);
    expect(isValid({ action: "remove_item", id: "class-0-CSE230" })).toBe(false);
    expect(isValid({ action: "next_item" })).toBe(true);
    expect(isValid({ action: "launch_rockets" })).toBe(false);
  });
});
