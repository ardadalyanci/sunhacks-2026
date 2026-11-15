import { describe, expect, it } from "vitest";
import { arizonaToday, formatTime, shortDay, weekDates } from "./time";

describe("day picker dates", () => {
  it("uses the Arizona date, which is UTC-7 all year", () => {
    expect(arizonaToday(Date.parse("2026-11-15T06:59:00Z"))).toBe("2026-11-14");
    expect(arizonaToday(Date.parse("2026-11-15T07:00:00Z"))).toBe("2026-11-15");
    expect(arizonaToday(Date.parse("2026-07-01T06:30:00Z"))).toBe("2026-06-30"); // no daylight saving in summer
  });

  it("lists a week from today across a month end, with short labels", () => {
    expect(weekDates("2026-11-27")).toEqual([
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
    ]);
    expect(shortDay("2026-11-16")).toBe("Mon 16");
    expect(shortDay("2026-12-01")).toBe("Tue 1");
  });
});

describe("formatTime", () => {
  it("formats clock hours the way students read them", () => {
    expect(formatTime(8)).toBe("8 am");
    expect(formatTime(12)).toBe("12 pm");
    expect(formatTime(13.5)).toBe("1:30 pm");
    expect(formatTime(23 + 59 / 60)).toBe("11:59 pm");
  });

  it("shows midnight at the end of a stretched day and never prints 60 minutes", () => {
    expect(formatTime(24)).toBe("12 am");
    expect(formatTime(0)).toBe("12 am");
    expect(formatTime(9.9999)).toBe("10 am");
  });
});
