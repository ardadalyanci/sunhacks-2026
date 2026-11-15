import { describe, expect, it } from "vitest";
import { briefingWithout } from "./briefing";

const LAB = "Work on: CSE 230: Lab 7 (pipelining)";
const HW = "Work on: MAT 343: Homework 9";

describe("briefingWithout", () => {
  const briefing =
    "Leave at 10:18 am for PSY 101 at the MU. I saved 8 am to work on Lab 7 for CSE 230, which is due tonight. " +
    "The Reading response fits after lunch.";

  it("keeps the briefing when nothing was removed", () => {
    expect(briefingWithout(briefing, [])).toBe(briefing);
  });

  it("drops the sentences that name a removed assignment", () => {
    expect(briefingWithout(briefing, [LAB])).toBe(
      "Leave at 10:18 am for PSY 101 at the MU. The Reading response fits after lunch.",
    );
  });

  it("matches the name in any case, and the long form of a homework", () => {
    const text = "Start lab 7 at 8 am. Work on Homework 9 after lunch. Leave at 10:18 am.";
    expect(briefingWithout(text, [LAB, HW])).toBe("Leave at 10:18 am.");
  });

  it("keeps a sentence that only says when the assignment is due", () => {
    const text = "Leave at 10:18 am. Lab 7 for CSE 230 is due at 11:59 pm. I saved 8 am for Lab 7.";
    expect(briefingWithout(text, [LAB])).toBe("Leave at 10:18 am. Lab 7 for CSE 230 is due at 11:59 pm.");
  });

  it("does not drop a sentence about another assignment with a longer number", () => {
    const text = "Lab 70 is due next week. I saved 8 am for Lab 7.";
    expect(briefingWithout(text, [LAB])).toBe("Lab 70 is due next week.");
  });

  it("keeps a briefing that does not name the removed assignment", () => {
    const text = "Leave at 10:18 am. HW 9 can wait until tonight.";
    expect(briefingWithout(text, [LAB])).toBe(text);
  });

  it("drops the lead-in of a sentence that followed a removed one", () => {
    const text = "Start with Lab 7 at 8 am. Then leave at 10:18 am for Hayden. Then lunch at the MU.";
    expect(briefingWithout(text, [LAB])).toBe("Leave at 10:18 am for Hayden. Then lunch at the MU.");
    expect(briefingWithout("Work on Lab 7 at 8 am. After that, head to Hayden.", [LAB])).toBe("Head to Hayden.");
  });

  it("does not split a sentence at a.m.", () => {
    const text = "Leave at 8 a.m. for the MU. I saved 9 a.m. for Lab 7.";
    expect(briefingWithout(text, [LAB])).toBe("Leave at 8 a.m. for the MU.");
  });

  it("says what happened when no sentence is left", () => {
    expect(briefingWithout("I saved 8 am to work on Lab 7.", [LAB, LAB])).toBe(
      "You took the Lab 7 study time off your day.",
    );
    expect(briefingWithout("Lab 7 at 8 am, then HW 9 at 2 pm.", [LAB, HW])).toBe(
      "You took the Lab 7 and HW 9 study time off your day.",
    );
  });
});
