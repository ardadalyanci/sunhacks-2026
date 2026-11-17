import { describe, expect, it } from "vitest";
import type { DayItem } from "@/lib/types";
import { dayFacts, dueReply, freeReply, freeTime, relativeReply, scheduleReply, timesIn, weatherReply, whereReply, withoutHeatTips } from "./facts";

const at = (hhmm: string) => `2026-11-16T${hhmm}:00-07:00`;
const item = (over: Partial<DayItem>): DayItem => ({ id: "x", type: "class", title: "X", start: at("10:00"), source: "planner", ...over });

const day = {
  date: "2026-11-16",
  today: "2026-11-16",
  items: [
    item({ id: "c1", title: "CSE 230", start: at("10:30"), end: at("11:20"), location: "BYENG 210", leaveAt: at("10:13") }),
    item({ id: "s1", type: "study_block", title: "Work on: CSE 230: Lab 7", start: at("12:00"), end: at("13:00") }),
    item({ id: "c2", title: "EGR 104", start: at("16:30"), end: at("17:20"), location: "Santan Hall 120", leaveAt: at("15:05"), via: "Gold shuttle from Forest Avenue and Lemon Street to SIM Building." }),
  ],
  suggestions: [],
  deadlines: [item({ id: "d1", type: "deadline", title: "CSE 230: Lab 7", start: at("23:59") }), item({ id: "d2", type: "deadline", title: "ENG 102: Essay", start: "2026-11-18T12:00:00-07:00" })],
  weather: { tempF: 88, highF: 92, isHot: false },
};

describe("day facts", () => {
  it("lists the schedule with leave times and how each trip is made, the free time, and the deadlines", () => {
    const facts = dayFacts(day, Date.parse(at("09:00")));
    expect(facts).toContain("NOW: 9 am.");
    expect(facts).toContain("- 10:30 am to 11:20 am: CSE 230 (class or commitment) at Brickyard 210. Leave 10:13 am, a 17-minute walk.");
    expect(facts).toContain("Leave 3:05 pm. Gold shuttle from Forest Avenue and Lemon Street to SIM Building.");
    expect(facts).toContain("- noon to 1 pm: study time, work on CSE 230: Lab 7.");
    expect(facts).toContain("FREE TIME FROM NOW: 9 am to 10:13 am (1 h 13 min); 11:20 am to noon (40 minutes); 1 pm to 3:05 pm (2 h 5 min); 5:20 pm to 10 pm (4 h 40 min).");
    expect(facts).toContain("- Lab 7 for CSE 230: due today at 11:59 pm, not turned in yet.");
    expect(facts).toContain("- the Essay for ENG 102: due Wednesday at noon, not turned in yet.");
  });

  it("marks what is over, and counts free time from now", () => {
    const facts = dayFacts(day, Date.parse(at("12:30")));
    expect(facts).toContain("CSE 230 (class or commitment) at Brickyard 210 (already over).");
    expect(freeTime(day, Date.parse(at("12:30")))[0].minutes).toBe(125); // 1 pm to 3:05 pm
  });

  it("answers what's due and when the student is free in plain words", () => {
    expect(dueReply(day, Date.parse(at("09:00")))).toBe("Lab 7 for CSE 230 is due today at 11:59 pm. The Essay for ENG 102 is due Wednesday at noon.");
    expect(dueReply({ ...day, deadlines: [] }, 0)).toMatch(/Canvas token/);
    expect(freeReply(day, Date.parse(at("17:30")))).toBe("You're free 5:30 pm to 10 pm (4 h 30 min).");
  });

  it("reads clock times the way the facts write them", () => {
    expect(timesIn("Leave at 10:13 AM, then noon, then 4 pm.")).toEqual(["10:13 am", "noon", "4 pm"]);
  });
});

describe("follow-ups and tips", () => {
  it("answers 'and after that?' from the stop named last in the chat", () => {
    const history = [{ text: "Can I grab lunch before CSE 230?" }, { text: "Yes, you're free until 10:13 am." }];
    expect(relativeReply("and what do I have after that?", history, day)).toBe("After CSE 230, you have study time for CSE 230: Lab 7 at noon and EGR 104 at 4:30 pm.");
    expect(relativeReply("what's before it?", [{ text: "Tell me about EGR 104" }], day)).toBe(
      "Before EGR 104, you have study time for CSE 230: Lab 7 at noon and CSE 230 at 10:30 am.",
    );
    expect(relativeReply("and after that?", [{ text: "hello" }], day)).toBeUndefined();
    expect(relativeReply("what's next?", history, day)).toBeUndefined();
  });

  it("drops water and heat tips on a day that is not hot", () => {
    const reply = "Yes, you're free from 1:50 pm to 2:44 pm. It is 78 degrees, so stay hydrated.";
    expect(withoutHeatTips(reply, { isHot: false })).toBe("Yes, you're free from 1:50 pm to 2:44 pm.");
    expect(withoutHeatTips(reply, { isHot: true })).toBe(reply);
  });
});

describe("a coming day the student picked (Monday, looking at Wednesday)", () => {
  const wed = (hhmm: string) => `2026-11-18T${hhmm}:00-07:00`;
  const ahead = {
    ...day,
    date: "2026-11-18",
    today: "2026-11-16",
    items: [
      item({ id: "s1", type: "study_block", title: "Work on: CSE 240: Quiz 5", start: wed("08:00"), end: wed("08:30") }),
      item({ id: "c1", title: "CSE 230", start: wed("10:30"), end: wed("11:20"), location: "BYENG 210", leaveAt: wed("10:13") }),
      item({ id: "c2", title: "CSE 240", start: wed("15:00"), end: wed("15:50"), location: "BYENG 190", leaveAt: wed("14:44") }),
    ],
    deadlines: [item({ id: "d1", type: "deadline", title: "CSE 240: Quiz 5", start: wed("23:59") })],
  };
  const monday9pm = Date.parse("2026-11-16T21:00:00-07:00");

  it("tells Gemini which day it is, with no clock from today", () => {
    const facts = dayFacts(ahead, monday9pm);
    expect(facts).toContain("DAY: Wednesday, November 18, a coming day (today is Monday, November 16).");
    expect(facts).not.toContain("NOW:");
    expect(facts).toContain("WEATHER: forecast high 92°F that day.");
    expect(facts).toContain("FREE TIME: 8:30 am to 10:13 am");
    expect(facts).toContain("- Quiz 5 for CSE 240: due Wednesday at 11:59 pm, not turned in yet.");
  });

  it("names the day in the code answers instead of saying today or now", () => {
    expect(dueReply(ahead, monday9pm)).toBe("Quiz 5 for CSE 240 is due Wednesday at 11:59 pm.");
    expect(freeReply(ahead, monday9pm)).toMatch(/^On Wednesday, you're free 8:30 am to 10:13 am/);
    expect(weatherReply(ahead)).toBe("On Wednesday, the high is 92°F.");
    expect(weatherReply({ ...ahead, date: "2026-11-17", items: [] })).toBe("Tomorrow, the high is 92°F.");
  });

  it("answers what is on part of the day, and where a class is", () => {
    expect(scheduleReply("what do I have in the morning?", ahead)).toBe(
      "On Wednesday morning, you have study time for Quiz 5 for CSE 240 at 8 am and CSE 230 at 10:30 am in Brickyard 210.",
    );
    expect(scheduleReply("any classes?", ahead)).toBe("On Wednesday, you have CSE 230 at 10:30 am in Brickyard 210 and CSE 240 at 3 pm in Brickyard 190.");
    expect(scheduleReply("what am I doing tonight", ahead)).toBe("On Wednesday evening, you have nothing planned.");
    expect(scheduleReply("what do I have this afternoon", day)).toBe(
      "This afternoon, you have study time for Lab 7 for CSE 230 at noon and EGR 104 at 4:30 pm in Santan Hall 120.",
    );
    expect(scheduleReply("can I add the mixer", day)).toBeUndefined();
    expect(whereReply("where is cse230?", ahead)).toBe("On Wednesday, CSE 230 is at 10:30 am in Brickyard 210. Leave at 10:13 am.");
    expect(whereReply("where is the gym?", ahead)).toBeUndefined();
  });
});
