import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassBlock } from "@/lib/types";
import { endAfter, isAdded, loadEdits, saveEdits, withEdits } from "./day-edits";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}
beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

const MON = "2026-11-16";
const classes: ClassBlock[] = [
  { course: "CSE 230", days: ["Mon", "Wed"], start: "10:30", end: "11:20", location: "BYENG 210" },
  { course: "MAT 343", days: ["Mon"], start: "13:30", end: "14:45" },
];

describe("day edits", () => {
  it("skips a class today, adds the student's own block, and leaves other days alone", () => {
    const edits = { add: [{ title: "Gym", start: "17:00", end: "18:00", location: "SDFC" }], skip: ["mat 343"] };
    expect(withEdits(classes, edits, MON)).toEqual([classes[0], { course: "Gym", days: ["Mon"], start: "17:00", end: "18:00", location: "SDFC" }]);
    expect(withEdits(classes, { add: [], skip: ["CSE 230"] }, "2026-11-18")).toEqual([classes[1]]); // Wednesday
    expect(isAdded(edits, "gym")).toBe(true);
  });

  it("keeps edits per day, drops malformed ones and empty days", () => {
    saveEdits(MON, { add: [{ title: "Gym", start: "17:00", end: "18:00" }], skip: ["MAT 343"], studyFrom: "15:50" });
    expect(loadEdits(MON)).toEqual({ add: [{ title: "Gym", start: "17:00", end: "18:00" }], skip: ["MAT 343"], studyFrom: "15:50" });
    expect(loadEdits("2026-11-17")).toEqual({ add: [], skip: [] });
    localStorage.setItem("daypilot.edits", JSON.stringify({ [MON]: { add: [{ title: "", start: "5pm", end: "x" }], skip: [7], studyFrom: "late" } }));
    expect(loadEdits(MON)).toEqual({ add: [], skip: [] });
    saveEdits(MON, { add: [], skip: [] });
    expect(localStorage.getItem("daypilot.edits")).toBe("{}");
  });

  it("works out the end of a block, never past midnight", () => {
    expect(endAfter("17:00", 90)).toBe("18:30");
    expect(endAfter("23:30", 60)).toBe("23:59");
  });
});
