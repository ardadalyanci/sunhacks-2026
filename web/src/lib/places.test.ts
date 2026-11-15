import { describe, expect, it } from "vitest";
import { polishLine, spokenAssignment, spokenStop } from "./places";

describe("spokenStop", () => {
  it("turns a course-labeled commitment into what students say", () => {
    expect(spokenStop("Study group: MAT 343")).toBe("MAT 343 study group");
    expect(spokenStop("Work shift")).toBe("Work shift");
    expect(spokenStop("CSE 230")).toBe("CSE 230");
    expect(spokenStop("Robotics club: build night")).toBe("Robotics club: build night");
  });
});

describe("spokenAssignment", () => {
  it("names an assignment the short way students say it", () => {
    expect(spokenAssignment("CSE 230: Lab 7 (pipelining)")).toBe("Lab 7 for CSE 230");
    expect(spokenAssignment("ENG 102: Reading response")).toBe("the Reading response for ENG 102");
    expect(spokenAssignment("MAT 343: Homework 9")).toBe("Homework 9 for MAT 343");
    expect(spokenAssignment("CSE 240: The final project")).toBe("The final project for CSE 240");
  });

  it("leaves titles without a course code alone", () => {
    expect(spokenAssignment("Lab safety quiz")).toBe("Lab safety quiz");
    expect(spokenAssignment("CSE230 Lab 7")).toBe("CSE230 Lab 7");
  });
});

describe("polishLine", () => {
  it("writes times the way the app does", () => {
    expect(polishLine("Leave by 10:13 AM, study at 8:00 AM, lunch at 12:00 PM.")).toBe(
      "Leave by 10:13 am, study at 8 am, lunch at noon.",
    );
    expect(polishLine("Due at 11:59 PM")).toBe("Due at 11:59 pm");
  });

  it("swaps building codes for the names students say and drops hype punctuation", () => {
    expect(polishLine("Leave for CSE 230 at BYENG 210 — it's a walk!")).toBe("Leave for CSE 230 at Brickyard 210, it's a walk.");
    expect(polishLine("Shift at MU, then COOR 170!!")).toBe("Shift at the MU, then Coor Hall 170.");
    expect(polishLine("a work shift at the the MU at 1:30 pm")).toBe("a work shift at the MU at 1:30 pm");
  });
});
