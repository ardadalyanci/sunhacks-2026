import { describe, expect, it } from "vitest";
import type { DayItem, DayPlan } from "@/lib/types";
import { HttpError, canvasNotice, errorKind, errorText, offlineAnswer } from "./errors";

const offline = new TypeError("Failed to fetch");
const timeout = new DOMException("The operation timed out.", "TimeoutError");
const server = new HttpError(500, "Request to /api/plan failed (500).");
const badToken = new HttpError(401, "Canvas rejected the token. Create a new one in Canvas → Account → Settings.");

describe("errorKind", () => {
  it("tells no connection, too slow, a server failure and anything else apart", () => {
    expect(errorKind(offline)).toBe("offline");
    expect(errorKind(timeout)).toBe("timeout");
    expect(errorKind(server)).toBe("server");
    expect(errorKind(new HttpError(502, ""))).toBe("server");
    expect(errorKind(new HttpError(400, "Send JSON."))).toBe("other");
    expect(errorKind(new Error("boom"))).toBe("other");
    expect(errorKind("text")).toBe("other");
    expect(errorKind(null)).toBe("other");
  });
});

describe("errorText", () => {
  it("never shows the raw error", () => {
    for (const e of [offline, timeout, server, new Error("boom"), undefined]) {
      for (const doing of ["first-load", "replan", "command"] as const) {
        const text = errorText(e, { doing });
        expect(text).not.toMatch(/Failed to fetch|\/api\/|\(5\d\d\)|boom|[!—]/);
      }
    }
  });

  it("says which day did not load and how to try again", () => {
    const monday = { doing: "switch", day: "Monday", chip: "Monday" } as const;
    expect(errorText(offline, monday)).toBe("I couldn't plan Monday. Check the Wi-Fi and tap Monday again.");
    expect(errorText(server, monday)).toBe("I couldn't plan Monday just now. Tap Monday again in a moment.");
    expect(errorText(timeout, { doing: "switch", day: "tomorrow", chip: "Tomorrow" })).toBe(
      "Sol took too long to plan tomorrow. Tap Tomorrow again.",
    );
  });

  it("has its own sentence for each kind of failure", () => {
    expect(errorText(offline, { doing: "first-load" })).toBe("No connection right now. Check the Wi-Fi and try again.");
    expect(errorText(server, { doing: "first-load" })).toBe("I couldn't plan your day just now. Try again in a moment.");
    expect(errorText(timeout, { doing: "replan" })).toBe("Sol took too long. Try again.");
    expect(errorText(offline, { doing: "replan" })).toMatch(/^No connection right now\. Your day is still here/);
    expect(errorText(server, { doing: "replan" })).toBe("I couldn't re-plan just now. Try again in a moment.");
    expect(errorText(server, { doing: "command" })).toBe("I couldn't do that right now. Try again in a moment.");
  });
});

describe("offlineAnswer", () => {
  const at = (hhmm: string) => `2026-11-15T${hhmm}:00-07:00`;
  const lab: DayItem = { id: "s0", type: "study_block", title: "Work on: CSE 230: Lab 7 (pipelining)", start: at("08:00"), end: at("10:00"), source: "planner" };
  const psy: DayItem = { id: "c1", type: "class", title: "PSY 101", start: at("10:30"), end: at("11:45"), leaveAt: at("10:18"), location: "Memorial Union", source: "manual" };
  const day: DayPlan = { date: "2026-11-15", items: [lab, psy], suggestions: [], briefing: "", aiUsed: false };
  const eight = Date.parse(at("08:00"));

  it("answers the next walk from the plan on screen", () => {
    expect(offlineAnswer("what's next?", day, eight)).toEqual({ reply: "Next is PSY 101 at 10:30 am. Leave at 10:18 am for the MU." });
    expect(offlineAnswer("When should I leave?", day, eight)).toEqual({ reply: "Next is PSY 101 at 10:30 am. Leave at 10:18 am for the MU." });
    expect(offlineAnswer("when should I leave?", day, Date.parse(at("10:20")))).toEqual({ reply: "Next is PSY 101 at 10:30 am. Leave now for the MU." });
    expect(offlineAnswer("what's next", day, Date.parse(at("12:00")))).toEqual({ reply: "You're done walking for today." });
  });

  it("finds the study block to drop", () => {
    expect(offlineAnswer("drop the study block", day, eight)).toEqual({ remove: lab });
    expect(offlineAnswer("drop the study block", day, Date.parse(at("11:00")))).toEqual({ reply: "There's no study block left on your day." });
  });

  it("leaves everything else to the apology", () => {
    expect(offlineAnswer("add the robotics meeting", day, eight)).toBeNull();
  });
});

describe("canvasNotice", () => {
  it("keeps Canvas's own words for a token problem", () => {
    expect(canvasNotice(badToken)).toBe(
      "Canvas rejected the token. Create a new one in Canvas → Account → Settings. Your classes and events are still here.",
    );
  });

  it("uses plain words when Canvas or the connection failed", () => {
    const plain = "Canvas did not load, so assignments are missing. Your classes and events are still here.";
    expect(canvasNotice(offline)).toBe(plain);
    expect(canvasNotice(new HttpError(502, "Canvas answered 503."))).toBe(plain);
    expect(canvasNotice(new HttpError(400, ""))).toBe(plain);
  });
});
