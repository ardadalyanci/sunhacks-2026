import { describe, expect, it } from "vitest";
import type { DayItem } from "@/lib/types";
import { dayFacts, dueReply, freeReply, freeTime, relativeReply, timesIn, withoutHeatTips } from "./facts";

const at = (hhmm: string) => `2026-11-16T${hhmm}:00-07:00`;
const item = (over: Partial<DayItem>): DayItem => ({ id: "x", type: "class", title: "X", start: at("10:00"), source: "planner", ...over });

const day = {
  date: "2026-11-16",
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
