import { describe, expect, it } from "vitest";
import { formatTime } from "./time";

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
