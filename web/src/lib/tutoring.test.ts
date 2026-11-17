import { describe, expect, it } from "vitest";
import { ENGINEERING_URL, subjectOf, tutoringHelp } from "./tutoring";
import type { DayItem } from "./types";

// Monday Nov 16, 2026 (Arizona time).
const DATE = "2026-11-16";
const at = (hhmm: string, date = DATE) => `${date}T${hhmm}:00-07:00`;
const ms = (hhmm: string) => Date.parse(at(hhmm));

const deadline = (id: string, title: string, start: string, done = false): DayItem => ({ id, type: "deadline", title, start, source: "canvas", done });
const cls = (title: string, start: string, end: string): DayItem => ({ id: `c-${title}`, type: "class", title, start: at(start), end: at(end), source: "manual" });

describe("subjectOf", () => {
  it("maps a course code to the tutoring subject that covers it", () => {
    expect(subjectOf("MAT 343: Homework 9")).toBe("math");
    expect(subjectOf("PHY 121: Problem set 8")).toBe("science");
    expect(subjectOf("ENG 102: Reading response")).toBe("writing");
    expect(subjectOf("CSE 230: Lab 7")).toBe("engineering");
    expect(subjectOf("HST 100: Essay")).toBeUndefined();
    expect(subjectOf("Club dues")).toBeUndefined();
  });
});

describe("tutoringHelp", () => {
  const classes = [cls("CSE 230", "10:30", "11:20"), cls("CSE 240", "15:00", "15:50")];

  it("names the subject's own center, open while the student is free, before the due time", () => {
    const due = deadline("d1", "MAT 343: Homework 9", at("23:59"));
    const [help] = tutoringHelp([due], classes, DATE, ms("08:00"));
    expect(help).toMatchObject({ deadlineId: "d1", center: "Math Tutoring Center", place: "Wexler Hall 116" });
    // Open 10 to 5. Before CSE 230 only 10:00-10:20 is left (under 30 minutes); after it, the walk there first.
    // The longest stretch wins over 4:00-5:00 after CSE 240.
    expect(help.from).toBe(at("11:30"));
    expect(help.to).toBe(at("14:50"));
  });

  it("sends a writing assignment to the Writing Center", () => {
    const [help] = tutoringHelp([deadline("d1", "ENG 102: Reading response", at("12:00", "2026-11-17"))], classes, DATE, ms("08:00"));
    expect(help).toMatchObject({ center: "Writing Center", place: "Noble Library 280", from: at("11:30"), to: at("14:50") });
  });

  it("counts study time for the same assignment as free, but not study time for another", () => {
    const due = deadline("d1", "MAT 343: Homework 9", at("23:59"));
    const study = (title: string): DayItem => ({ id: "s", type: "study_block", title: `Work on: ${title}`, start: at("11:20"), end: at("14:50"), source: "planner" });
    expect(tutoringHelp([due], [...classes, study(due.title)], DATE, ms("08:00"))[0].from).toBe(at("11:30"));
    // Other homework fills 11:20-2:50, so the next free stretch is after CSE 240 (and the walk), until 5.
    const [later] = tutoringHelp([due], [...classes, study("PHY 121: Problem set 8")], DATE, ms("08:00"));
    expect(later).toMatchObject({ center: "Math Tutoring Center", from: at("16:00"), to: at("17:00") });
  });

  it("stops at the due time, and needs 30 minutes before it", () => {
    // Free all morning; the general center opens at 10, so 10:00-10:50 is the window before a 10:50 due time.
    const [help] = tutoringHelp([deadline("d1", "PHY 121: Problem set 8", at("10:50"))], [], DATE, ms("08:00"));
    expect(help).toMatchObject({ center: "Tutoring Center", from: at("10:00"), to: at("10:50") });
    expect(tutoringHelp([deadline("d1", "PHY 121: Problem set 8", at("10:20"))], [], DATE, ms("08:00"))).toEqual([]);
  });

  it("uses the student's campus, then online", () => {
    const due = deadline("d1", "MAT 343: Homework 9", at("23:59"));
    expect(tutoringHelp([due], [], DATE, ms("08:00"), "downtown")[0]).toMatchObject({ place: "UCENT 101", from: at("11:00"), to: at("17:00") });
    // Sunday: no campus center is open, the online one is from 3 pm.
    const sunday = "2026-11-15";
    const [online] = tutoringHelp([deadline("d1", "MAT 343: Homework 9", at("23:59", sunday))], [], sunday, Date.parse(at("08:00", sunday)));
    expect(online.center).toBe("Online Tutoring Center (Zoom)");
    expect(online.place).toBeUndefined();
  });

  it("prefers the stretch around the assignment's own study time over a longer one", () => {
    const due = deadline("d1", "MAT 343: Homework 9", at("23:59"));
    const study: DayItem = { id: "s", type: "study_block", title: `Work on: ${due.title}`, start: at("16:00"), end: at("16:45"), source: "planner" };
    expect(tutoringHelp([due], [...classes, study], DATE, ms("08:00"))[0]).toMatchObject({ from: at("16:00"), to: at("17:00") });
  });

  it("helps with a final draft or project, not with a graded quiz, exam or midterm", () => {
    const titles = ["ENG 102: Final draft", "ENG 102: Quiz 4", "MAT 343: Exam 2 review", "PHY 121: Midterm"];
    const help = tutoringHelp(titles.map((t, i) => deadline(`d${i}`, t, at("23:59"))), [], DATE, ms("08:00"));
    expect(help.map((h) => h.deadlineId)).toEqual(["d0"]);
  });

  it("skips turned-in, past-due and graded quizzes or exams, and courses no center covers", () => {
    const list = [
      deadline("done", "MAT 343: Homework 9", at("23:59"), true),
      deadline("past", "MAT 343: Homework 8", at("07:00")),
      deadline("quiz", "MAT 343: Quiz 5", at("23:59")),
      deadline("hst", "HST 100: Essay", at("23:59")),
    ];
    expect(tutoringHelp(list, [], DATE, ms("08:00"))).toEqual([]);
  });

  it("gives engineering courses the engineering tutoring link without times", () => {
    expect(tutoringHelp([deadline("d1", "CSE 230: Lab 7 (pipelining)", at("23:59"))], classes, DATE, ms("08:00"))).toEqual([
      { deadlineId: "d1", center: "Engineering Tutoring Centers", url: ENGINEERING_URL },
    ]);
  });
});
