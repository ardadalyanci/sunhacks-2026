import { describe, expect, it } from "vitest";
import type { DayItem } from "@/lib/types";
import {
  PIN_HEIGHT,
  assignmentName,
  blockTitle,
  coversOtherBlock,
  dayBounds,
  dayStops,
  hourOn,
  isDarkHour,
  rangeLabel,
  skyBackground,
  stackPins,
  stopAt,
  sunTimes,
} from "./sky-layout";

const DATE = "2026-11-14";
const at = (hhmm: string, date = DATE) => `${date}T${hhmm}:00-07:00`;

function item(type: DayItem["type"], start: string, end?: string, leaveAt?: string): DayItem {
  return { id: `${type}-${start}`, type, title: type, start, end, leaveAt, source: "planner" };
}

describe("hourOn", () => {
  it("reads Arizona hours and clamps other days to the edges", () => {
    expect(hourOn(at("13:30"), DATE)).toBe(13.5);
    expect(hourOn(at("00:30", "2026-11-15"), DATE)).toBe(24);
    expect(hourOn(at("23:00", "2026-11-13"), DATE)).toBe(0);
  });
});

describe("dayBounds", () => {
  it("keeps 8 am to 10 pm for a normal day", () => {
    expect(dayBounds([item("class", at("10:30"), at("11:20"))], DATE)).toEqual({ first: 8, last: 22 });
  });

  it("stretches to an early class and its leave time", () => {
    const early = item("class", at("07:30"), at("08:20"), at("07:12"));
    expect(dayBounds([early], DATE)).toEqual({ first: 7, last: 22 });
  });

  it("stretches the end to an 11:59 pm deadline, but an early deadline stays at the top edge", () => {
    expect(dayBounds([item("deadline", at("23:59"))], DATE)).toEqual({ first: 8, last: 24 });
    expect(dayBounds([item("deadline", at("06:00"))], DATE)).toEqual({ first: 8, last: 22 });
  });

  it("ends at midnight for an event that runs into the next day", () => {
    expect(dayBounds([item("event", at("21:00"), at("01:00", "2026-11-15"))], DATE)).toEqual({ first: 8, last: 24 });
  });
});

describe("stackPins", () => {
  it("leaves pins that do not touch where they are", () => {
    expect(stackPins([100, 300], 800)).toEqual([100 - PIN_HEIGHT / 2, 300 - PIN_HEIGHT / 2]);
  });

  it("stacks pins at the same time instead of overlapping, keeping their order", () => {
    const tops = stackPins([400, 400, 400], 800);
    expect(tops[1] - tops[0]).toBeGreaterThanOrEqual(PIN_HEIGHT);
    expect(tops[2] - tops[1]).toBeGreaterThanOrEqual(PIN_HEIGHT);
  });

  it("keeps pins at the bottom edge inside the sky", () => {
    const tops = stackPins([795, 799], 800);
    expect(Math.max(...tops) + PIN_HEIGHT).toBeLessThanOrEqual(800);
    expect(tops[1] - tops[0]).toBeGreaterThanOrEqual(PIN_HEIGHT);
  });

  it("returns tops in the input order", () => {
    const tops = stackPins([500, 100], 800);
    expect(tops[0]).toBeGreaterThan(tops[1]);
  });
});

describe("labels", () => {
  it("shortens Canvas titles for pins and blocks", () => {
    expect(assignmentName("CSE 230: Lab 7 (pipelining)")).toBe("Lab 7");
    expect(assignmentName("MAT 343: Homework 9")).toBe("HW 9");
    expect(assignmentName("Reading response")).toBe("Reading response");
    expect(blockTitle("Work on: CSE 230: Lab 7 (pipelining)")).toBe("Work on Lab 7 · CSE 230");
    expect(blockTitle("Work shift")).toBe("Work shift");
  });

  it("writes a block's time with am/pm once when it can", () => {
    expect(rangeLabel(10.5, 11 + 20 / 60)).toBe("10:30–11:20 am");
    expect(rangeLabel(11.5, 12 + 20 / 60)).toBe("11:30 am–12:20 pm");
    expect(rangeLabel(13.5, 14.75)).toBe("1:30–2:45 pm");
  });
});

describe("coversOtherBlock", () => {
  const boxes = [
    { id: "study", top: 100, bottom: 140 },
    { id: "class", top: 150, bottom: 200 },
  ];

  it("is true when a leave pin lands on the study block before its class", () => {
    expect(coversOtherBlock(140, boxes, "class")).toBe(true);
  });

  it("ignores the pin's own block and blocks it only touches", () => {
    expect(coversOtherBlock(160, [{ id: "class", top: 150, bottom: 200 }], "class")).toBe(false);
    expect(coversOtherBlock(100 - PIN_HEIGHT / 2 - 1, boxes, "class")).toBe(false);
  });
});

describe("sun", () => {
  const hhmm = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

  it("puts sunrise and sunset in Tempe within a few minutes of the almanac", () => {
    const nov = sunTimes("2026-11-14"); // almanac: 6:59 am, 5:24 pm MST
    expect(Math.abs(nov.sunrise - (6 + 59 / 60))).toBeLessThan(5 / 60);
    expect(Math.abs(nov.sunset - (17 + 24 / 60))).toBeLessThan(5 / 60);
    const june = sunTimes("2026-06-21"); // almanac: 5:19 am, 7:42 pm
    expect(hhmm(june.sunrise)).toMatch(/^5:(1[4-9]|2[0-4])$/);
    expect(hhmm(june.sunset)).toMatch(/^19:(3[7-9]|4[0-7])$/);
  });

  it("makes the evening sky dark sooner in November than in June", () => {
    expect(isDarkHour(19, sunTimes("2026-11-14"))).toBe(true);
    expect(isDarkHour(19, sunTimes("2026-06-21"))).toBe(false);
  });
});

describe("Play my day stops", () => {
  const sun = { sunrise: 7, sunset: 17.4 };
  const items: DayItem[] = [
    item("class", at("10:30"), at("11:20"), at("10:13")),
    { ...item("deadline", at("17:00")), title: "MAT 343: Homework 9", done: true },
    { ...item("deadline", at("23:59")), title: "CSE 230: Lab 7 (pipelining)" },
  ];
  const stops = dayStops(items, DATE, sun, () => "Brickyard 210");

  it("stops at each walk, deadline and the sunset, in time order", () => {
    expect(stops.map((s) => s.text)).toEqual(["Leave now for Brickyard 210", "HW 9: turned in", "Sunset, 5:24 pm", "Lab 7 is due"]);
    expect(stops[1].mood).toBe("proud");
  });

  it("holds a stop's caption for a while, then lets it go", () => {
    expect(stopAt(stops, 10.3)?.text).toBe("Leave now for Brickyard 210");
    expect(stopAt(stops, 12)).toBeUndefined();
  });
});

describe("skyBackground", () => {
  it("places each hour's color at that hour", () => {
    const y = (hour: number) => (hour - 8) * 10;
    expect(skyBackground(y, false)).toContain("#eef6ff 0px");
    expect(skyBackground(y, false)).toContain("#2b2766 140px");
    expect(skyBackground(y, true).startsWith("linear-gradient(to bottom, rgb(255 110 50 / 0)")).toBe(true);
  });
});
