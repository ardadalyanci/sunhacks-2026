import { describe, expect, it } from "vitest";
import { dayOpener, isCourse, spokenEvent, spokenItem, tidyBriefing } from "./say";
import type { DayItem } from "./types";

const item = (type: DayItem["type"], title: string): DayItem => ({ id: "x", type, title, start: "2026-11-15T10:30:00-07:00", source: "planner" });

describe("isCourse", () => {
  it("is true only for an exact course code", () => {
    expect(isCourse("CSE 230")).toBe(true);
    expect(isCourse("BIO 181L")).toBe(true);
    expect(isCourse("MAT 343 study group")).toBe(false);
    expect(isCourse("Study group: MAT 343")).toBe(false);
    expect(isCourse("Work shift")).toBe(false);
  });
});

describe("spokenEvent", () => {
  it("says an event the way a student would", () => {
    expect(spokenEvent("Lunch & learn: landing a software internship")).toBe("the lunch & learn");
    expect(spokenEvent("Hackathon team mixer")).toBe("the hackathon team mixer");
    expect(spokenEvent("Sun Devil Robotics build night")).toBe("the Sun Devil Robotics build night");
    expect(spokenEvent("SHPE general meeting")).toBe("the SHPE general meeting");
    expect(spokenEvent("The great debate")).toBe("the great debate");
  });
});

describe("spokenItem", () => {
  it("names courses, commitments, study time and events", () => {
    expect(spokenItem(item("class", "CSE 230"))).toBe("CSE 230");
    expect(spokenItem(item("class", "Work shift"))).toBe("your work shift");
    expect(spokenItem(item("class", "MAT 343 study group"))).toBe("your MAT 343 study group");
    expect(spokenItem(item("class", "Study group: MAT 343"))).toBe("your MAT 343 study group");
    expect(spokenItem(item("study_block", "Work on: ENG 102: Reading response"))).toBe("the Reading response for ENG 102");
    expect(spokenItem(item("study_block", "Work on: CSE 230: Lab 7 (pipelining)"))).toBe("Lab 7 for CSE 230");
    expect(spokenItem(item("event", "Robotics club build night"))).toBe("the robotics club build night");
  });
});

describe("dayOpener", () => {
  const now = Date.parse("2026-11-15T20:00:00-07:00"); // Sunday evening in Tempe
  it("names a later day and stays quiet for today", () => {
    expect(dayOpener("2026-11-15T22:00:00-07:00", now)).toBeNull();
    expect(dayOpener("2026-11-16T08:00:00-07:00", now)).toBe("Tomorrow");
    expect(dayOpener("2026-11-17T08:00:00-07:00", now)).toBe("On Tuesday");
  });
});

describe("tidyBriefing", () => {
  it("never puts 'now' next to a clock time", () => {
    expect(tidyBriefing("Work on Lab 7 right now at 8 am, since it's due tonight.")).toBe("Work on Lab 7 at 8 am, since it's due tonight.");
    expect(tidyBriefing("Right now, at 8 am you're free.")).toBe("At 8 am you're free.");
    expect(tidyBriefing("Leave now for CSE 230.")).toBe("Leave now for CSE 230.");
    expect(tidyBriefing("You know at 3 pm it gets hot.")).toBe("You know at 3 pm it gets hot.");
  });

  it("reads a.m. and p.m. as times, not as the end of a sentence", () => {
    expect(tidyBriefing("Leave at 10:18 a.m. for your study group at Hayden. I saved 8 a.m. to 10 a.m. for Lab 7, due at 11:59 p.m. tonight.")).toBe(
      "Leave at 10:18 am for your study group at Hayden. I saved 8 am to 10 am for Lab 7, due at 11:59 pm tonight.",
    );
    expect(tidyBriefing("Lab 7 is due at 11:59 p.m. Then rest.")).toBe("Lab 7 is due at 11:59 pm. Then rest.");
    expect(tidyBriefing("It's due at 5 P.M.")).toBe("It's due at 5 pm.");
  });

  it("cuts the stock openers the model still slips in", () => {
    expect(tidyBriefing("I saved 8 am for Lab 7. You can also check out the lunch & learn at noon.")).toBe(
      "I saved 8 am for Lab 7. Check out the lunch & learn at noon.",
    );
    expect(tidyBriefing("You'll want to leave at 10:18 am. You've got Lab 7 tonight.")).toBe("Leave at 10:18 am. You have Lab 7 tonight.");
  });
});
