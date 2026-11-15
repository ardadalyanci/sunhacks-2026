import { describe, expect, it } from "vitest";
import type { ClassBlock } from "@/lib/types";
import { classProblem, isBlankClass } from "./classes";

const row = (patch: Partial<ClassBlock> = {}): ClassBlock => ({
  course: "CSE 240",
  days: ["Mon", "Wed"],
  start: "10:30",
  end: "11:45",
  location: "COOR 170",
  ...patch,
});

describe("classProblem", () => {
  it("accepts a complete class, including weekend days", () => {
    expect(classProblem(row())).toBe("");
    expect(classProblem(row({ days: ["Sat"] }))).toBe("");
  });

  it("names the one thing to fix", () => {
    expect(classProblem(row({ course: "  " }))).toMatch(/class or shift/);
    expect(classProblem(row({ days: [] }))).toMatch(/days/);
    expect(classProblem(row({ start: "" }))).toMatch(/start and an end time/);
    expect(classProblem(row({ end: "25:00" }))).toMatch(/start and an end time/);
    expect(classProblem(row({ start: "11:45", end: "10:30" }))).toMatch(/after the start/);
    expect(classProblem(row({ start: "10:30", end: "10:30" }))).toMatch(/after the start/);
  });
});

describe("isBlankClass", () => {
  it("is true only for an untouched row", () => {
    expect(isBlankClass(row({ course: "", days: [], location: "" }))).toBe(true);
    expect(isBlankClass(row({ course: "", days: [], location: "BYENG" }))).toBe(false);
    expect(isBlankClass(row({ days: [] }))).toBe(false);
  });
});
