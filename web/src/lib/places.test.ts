import { describe, expect, it } from "vitest";
import { findPlace, placeLabel, polishLine, spokenAssignment, spokenStop } from "./places";

describe("spokenStop", () => {
  it("turns a course-labeled commitment into what students say", () => {
    expect(spokenStop("Study group: MAT 343")).toBe("MAT 343 study group");
    expect(spokenStop("MAT 343 study group")).toBe("MAT 343 study group");
    expect(spokenStop("Work shift")).toBe("Work shift");
    expect(spokenStop("CSE 230")).toBe("CSE 230");
    expect(spokenStop("Robotics club: build night")).toBe("Robotics club: build night");
  });
});

describe("placeLabel", () => {
  it("says a room the way students do: MU 202, but the MU on its own", () => {
    expect(placeLabel("Memorial Union 202")).toBe("MU 202");
    expect(placeLabel("MU 202")).toBe("MU 202");
    expect(placeLabel("MU-242")).toBe("MU 242");
    expect(placeLabel("Memorial Union")).toBe("the MU");
    expect(placeLabel("BYENG 210")).toBe("Brickyard 210");
    expect(placeLabel("Hayden Library")).toBe("Hayden");
    expect(placeLabel("Somewhere new")).toBe("Somewhere new");
  });

  it("matches a building name only as whole words", () => {
    expect(findPlace("MU-242")).toMatchObject({ building: { id: "MU" }, room: "242" });
    expect(findPlace("Mustang Hall").building).toBeUndefined();
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
    expect(polishLine("Robotics night at MU 230.")).toBe("Robotics night at MU 230.");
  });

  it("leaves course codes that are also building ids alone", () => {
    expect(polishLine("Leave for PSY 101 at Coor 170")).toBe("Leave for PSY 101 at Coor 170");
    expect(polishLine("You're free after ART 113 and BA 301.")).toBe("You're free after ART 113 and BA 301.");
  });
});

describe("polishLine and noon", () => {
  it("says noon for 12 pm and leaves the 12 in 4:12 pm alone", () => {
    expect(polishLine("Lunch at 12 PM, then leave at 4:12 pm.")).toBe("Lunch at noon, then leave at 4:12 pm.");
  });
});
