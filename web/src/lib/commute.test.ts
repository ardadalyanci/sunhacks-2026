import { describe, expect, it } from "vitest";
import { commuteMinutes, inPhoenixArea, metersBetween, milesText, nearestCampus, roadMiles, roundPoint } from "./commute";

// Two public places: Tempe Town Lake's Tempe Center for the Arts, and Brickyard on the Tempe campus.
const TCA = { lat: 33.4316, lng: -111.9452 };
const BYENG = { lat: 33.4235, lng: -111.9397 };

describe("commute", () => {
  it("turns road distance into minutes for each way to travel", () => {
    const meters = metersBetween(TCA, BYENG);
    expect(meters).toBeGreaterThan(1000);
    expect(meters).toBeLessThan(1100);
    expect(commuteMinutes(TCA, BYENG, "walk")).toBe(Math.ceil((meters * 1.3) / 80 + 2));
    expect(commuteMinutes(TCA, BYENG, "bike")).toBe(Math.ceil((meters * 1.3) / 250 + 3));
    expect(commuteMinutes(TCA, BYENG, "drive")).toBe(Math.ceil((meters * 1.3) / 500 + 10));
  });

  it("adds heat minutes outdoors only, and the slower pace to walks only", () => {
    expect(commuteMinutes(TCA, BYENG, "bike", { hot: true }) - commuteMinutes(TCA, BYENG, "bike")).toBe(2);
    expect(commuteMinutes(TCA, BYENG, "drive", { hot: true, slower: true })).toBe(commuteMinutes(TCA, BYENG, "drive"));
    expect(commuteMinutes(TCA, BYENG, "walk", { slower: true })).toBeGreaterThan(commuteMinutes(TCA, BYENG, "walk"));
  });

  it("finds the nearest campus, rounds the point and keeps it in the Phoenix area", () => {
    expect(nearestCampus(TCA)).toBe("tempe");
    expect(nearestCampus({ lat: 33.45, lng: -112.07 })).toBe("downtown");
    expect(nearestCampus({ lat: 33.3, lng: -111.68 })).toBe("polytechnic");
    expect(nearestCampus({ lat: 33.6, lng: -112.17 })).toBe("west");
    expect(roundPoint({ lat: 33.43164, lng: -111.94526 })).toEqual({ lat: 33.432, lng: -111.945 });
    expect(inPhoenixArea(TCA)).toBe(true);
    expect(inPhoenixArea({ lat: 32.22, lng: -110.97 })).toBe(false); // Tucson
  });

  it("says miles the way people do", () => {
    expect(milesText(roadMiles(TCA, BYENG))).toBe("0.8 miles");
    expect(milesText(1)).toBe("1 mile");
    expect(milesText(12.4)).toBe("12 miles");
  });
});
