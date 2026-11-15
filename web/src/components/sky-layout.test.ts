import { describe, expect, it } from "vitest";
import type { DayItem } from "@/lib/types";
import {
  PIN_HEIGHT,
  assignmentName,
  blockTitle,
  captionSpot,
  coversOtherBlock,
  dayBounds,
  dayStops,
  hourOn,
  isDarkHour,
  layoutPins,
  narrowedBlocks,
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
  const sun = { sunrise: 6.98, sunset: 17.4 }; // mid November in Tempe

  it("ends an hour after the sunset, rounded up, on a day that is over by then", () => {
    expect(dayBounds([item("class", at("10:30"), at("11:20"))], DATE, sun)).toEqual({ first: 8, last: 19 });
    expect(dayBounds([], DATE, sun)).toEqual({ first: 8, last: 19 });
  });

  it("ends an hour after the last block when that is after the sunset", () => {
    expect(dayBounds([item("event", at("18:00"), at("19:30"))], DATE, sun)).toEqual({ first: 8, last: 21 });
    expect(dayBounds([item("study_block", at("20:00"), at("21:00"))], DATE, sun)).toEqual({ first: 8, last: 22 });
  });

  it("stretches the start to an early class and its leave time", () => {
    const early = item("class", at("07:30"), at("08:20"), at("07:12"));
    expect(dayBounds([early], DATE, sun)).toEqual({ first: 7, last: 19 });
  });

  it("never stretches for a deadline: an 11:59 pm or a 6 am one sits as a pin at the edge", () => {
    expect(dayBounds([item("deadline", at("23:59"))], DATE, sun)).toEqual({ first: 8, last: 19 });
    expect(dayBounds([item("deadline", at("06:00"))], DATE, sun)).toEqual({ first: 8, last: 19 });
  });

  it("reaches the current hour on a real today, so Sol's now stays on the sky", () => {
    expect(dayBounds([], DATE, sun, 21.4)).toEqual({ first: 8, last: 22 });
    expect(dayBounds([], DATE, sun, 9)).toEqual({ first: 8, last: 19 });
  });

  it("ends at midnight for an event that runs into the next day", () => {
    expect(dayBounds([item("event", at("21:00"), at("01:00", "2026-11-15"))], DATE, sun)).toEqual({ first: 8, last: 24 });
  });

  it("follows the later June sunset", () => {
    expect(dayBounds([], "2026-06-21", sunTimes("2026-06-21")).last).toBe(21); // sunset 7:42 pm
  });
});

describe("layoutPins", () => {
  const study = { id: "study", top: 300, bottom: 335 }; // a short study block
  const cls = { id: "class", top: 345, bottom: 400 }; // the class right after it

  it("keeps a pin that touches nothing out of the lane", () => {
    expect(layoutPins([{ center: 100, ownId: "x" }], 800, [study, cls])).toEqual([{ top: 100 - PIN_HEIGHT / 2, lane: false }]);
  });

  it("moves a leave pin that lands on the study block into the lane, and lets it sit on its own class's edge", () => {
    expect(layoutPins([{ center: 330, ownId: "class" }], 800, [study, cls])[0].lane).toBe(true);
    expect(layoutPins([{ center: 345, ownId: "class" }], 800, [cls])[0].lane).toBe(false);
  });

  it("decides the lane after stacking: a deadline pushed down onto a class goes into the lane", () => {
    // A leave pin at 11:59 and a deadline at 12:00 sit in the free sky; stacked, the deadline lands on the 12:15 class.
    const at1215 = { id: "phy", top: 330, bottom: 385 };
    const spots = layoutPins(
      [
        { center: 300, ownId: "phy" },
        { center: 302, ownId: "" },
      ],
      800,
      [at1215],
    );
    expect(spots[0].lane).toBe(false);
    expect(spots[1].top).toBeGreaterThan(spots[0].top);
    expect(spots[1].lane).toBe(true);
  });

  it("counts a pin's own block once stacking has pushed it onto that block", () => {
    const spots = layoutPins(
      [
        { center: 300, ownId: "" },
        { center: 300, ownId: "class" },
      ],
      800,
      [{ id: "class", top: 318, bottom: 380 }],
    );
    expect(spots[1].lane).toBe(true);
  });

  it("narrows only the blocks that share their height with a lane pin", () => {
    const narrowed = narrowedBlocks(
      [
        { top: 310, lane: true },
        { top: 100, lane: false },
      ],
      [study, cls, { id: "far", top: 90, bottom: 130 }],
    );
    expect([...narrowed]).toEqual(["study"]);
  });

  it("leaves a tall block wide when the lane pin only touches its top padding", () => {
    // "Leave 1:25 pm" ends 12 px into the 12:50 study block and 7 px into the 1:30 work shift.
    const spot = { top: 316, lane: true };
    expect([...narrowedBlocks([spot], [{ id: "study", top: 290, bottom: 328 }, { id: "shift", top: 337, bottom: 500 }])]).toEqual(["study"]);
    // A tall block with centered text says how much padding it has; 9 px of reach stays inside it.
    expect(narrowedBlocks([{ top: 316, lane: true }], [{ id: "shift", top: 335, bottom: 500, pad: 56 }]).size).toBe(0);
  });
});

describe("captionSpot", () => {
  it("puts Sol's caption above his line when nothing is there", () => {
    expect(captionSpot(300, [], 800)).toEqual({ below: false, right: false });
  });

  it("puts it below his line at the very top of the sky", () => {
    expect(captionSpot(14, [], 800)).toEqual({ below: true, right: false });
  });

  it("keeps clear of a leave pin at Sol's hour by moving to the right side", () => {
    // Sol has just reached the 10:18 leave pin: it covers both the space above and below him on the left.
    expect(captionSpot(300, [{ top: 300 - PIN_HEIGHT / 2, right: false }], 800)).toEqual({ below: false, right: true });
  });

  it("at rest, keeps clear of a block's text by moving to the right side", () => {
    // Sol rests at 8 am on the top edge, and the first study block starts right there.
    expect(captionSpot(14, [], 800, [{ id: "study", top: 16, bottom: 76 }])).toEqual({ below: true, right: true });
    expect(captionSpot(300, [], 800, [{ id: "far", top: 500, bottom: 560 }])).toEqual({ below: false, right: false });
  });

  it("goes below when only the space above is taken", () => {
    expect(captionSpot(300, [{ top: 260, right: false }], 800)).toEqual({ below: true, right: false });
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
