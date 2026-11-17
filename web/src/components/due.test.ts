import { describe, expect, it } from "vitest";
import { dueStatus, splitCourse } from "./due";

const at = (date: string, hhmm: string) => `${date}T${hhmm}:00-07:00`;
const TODAY = "2026-11-16";
const TOMORROW = "2026-11-17";
const now = Date.parse(at(TODAY, "08:00"));

describe("dueStatus", () => {
  it("counts down within two days and says which day it is due", () => {
    expect(dueStatus(at(TODAY, "23:59"), now, TODAY, TOMORROW)).toEqual({ urgency: "today", left: "15 h 59 min left" });
    expect(dueStatus(at(TOMORROW, "12:00"), now, TODAY, TOMORROW)).toEqual({ urgency: "tomorrow", left: "28 h left" });
    expect(dueStatus(at("2026-11-19", "23:59"), now, TODAY, TOMORROW)).toEqual({ urgency: "later", left: "3 days left" });
  });

  it("marks a passed due time as overdue", () => {
    expect(dueStatus(at(TODAY, "07:00"), now, TODAY, TOMORROW)).toEqual({ urgency: "overdue", left: "Overdue" });
  });

  it("goes by the date alone before the clock is known", () => {
    expect(dueStatus(at(TODAY, "07:00"), 0, TODAY, TOMORROW)).toEqual({ urgency: "today", left: "" });
  });
});

describe("splitCourse", () => {
  it("splits the course code from the task", () => {
    expect(splitCourse("CSE 230: Lab 7 (pipelining)")).toEqual({ course: "CSE 230", task: "Lab 7 (pipelining)" });
    expect(splitCourse("Club dues")).toEqual({ task: "Club dues" });
  });
});
