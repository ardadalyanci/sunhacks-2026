import { describe, expect, it } from "vitest";
import { polishLine } from "./places";

describe("polishLine", () => {
  it("writes times the way the app does", () => {
    expect(polishLine("Leave by 10:13 AM, study at 8:00 AM, lunch at 12:00 PM.")).toBe(
      "Leave by 10:13 am, study at 8 am, lunch at noon.",
    );
    expect(polishLine("Due at 11:59 PM")).toBe("Due at 11:59 pm");
  });

  it("swaps building codes for the names students say and drops hype punctuation", () => {
    expect(polishLine("Leave for CSE 230 at BYENG 210 — it's a walk!")).toBe("Leave for CSE 230 at Brickyard 210, it's a walk.");
    expect(polishLine("Shift at MU, then COOR 170!!")).toBe("Shift at the MU, then Coor Hall 170.");
    expect(polishLine("a work shift at the the MU at 1:30 pm")).toBe("a work shift at the MU at 1:30 pm");
  });
});
