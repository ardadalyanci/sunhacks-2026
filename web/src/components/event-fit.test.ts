import { describe, expect, it } from "vitest";
import type { DayItem, Opportunity } from "@/lib/types";
import { cleanDescription, fitOnDay } from "./event-fit";

const at = (hhmm: string) => `2026-11-16T${hhmm}:00-07:00`;
const event = (start: string, end: string): Opportunity => ({
  id: "x",
  kind: "club_event",
  title: "Concert",
  organizer: "",
  description: "",
  url: "",
  startsAt: at(start),
  endsAt: at(end),
  tags: [],
  source: "asu_events",
  fetchedAt: at("07:00"),
});
const mat343: DayItem = {
  id: "class-1",
  type: "class",
  title: "MAT 343",
  start: at("13:30"),
  end: at("14:45"),
  leaveAt: at("13:19"),
  source: "manual",
};

describe("cleanDescription", () => {
  it("drops emoji and extra space", () => {
    expect(cleanDescription("🎉 Kannada Rajyotsava 🎶  night!\n\nJoin us ✨")).toBe("Kannada Rajyotsava night! Join us");
  });

  it("cuts long text at a word", () => {
    const long = "word ".repeat(80);
    const out = cleanDescription(long, 50);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/wor…$/);
  });
});

describe("fitOnDay", () => {
  it("fits in a free gap", () => {
    expect(fitOnDay(event("16:00", "17:00"), [mat343])).toEqual({ fits: true });
  });

  it("clashes with a class, counting the walk to it", () => {
    expect(fitOnDay(event("12:30", "13:25"), [mat343])).toEqual({ fits: false, clash: mat343 });
    expect(fitOnDay(event("14:00", "15:00"), [mat343])).toEqual({ fits: false, clash: mat343 });
  });
});
