import { describe, expect, it } from "vitest";
import { isCampus, shuttleLeg, shuttleOptions } from "./shuttles";

// Fixed clock: the expo is on Sunday Nov 15 2026; Monday Nov 16 is a school day.
const SUN = new Date("2026-11-15T12:30:00-07:00");
const MON = new Date("2026-11-16T07:00:00-07:00");

describe("shuttleOptions", () => {
  it("uses weekend service on Sunday: Gold every 2 hours, Forest & Lemon 9:00 AM to 7:00 PM", () => {
    const r = shuttleOptions({ from: "tempe", to: "polytechnic", at: SUN });
    expect(r.period).toBe("weekend");
    expect(r.options).toHaveLength(1);
    const gold = r.options[0];
    expect(gold).toMatchObject({ routeId: "gold", running: true, everyMinutes: 120, rideMinutes: 50, boardAt: "Forest Avenue and Lemon Street", alightAt: "SIM Building" });
    expect(gold.window).toEqual({ first: "9:00 AM", last: "7:00 PM" });
    expect(gold.summary).toContain("about every 2 hours");
    expect(r.note).toMatch(/approximate/i);
    expect(r.trackerUrl).toBe("https://asu-shuttles.rider.peaktransit.com/");
  });

  it("says plainly when a route has no weekend service", () => {
    const r = shuttleOptions({ from: "tempe", to: "west", at: SUN });
    const express = r.options.find((o) => o.routeId === "tempe-west-express")!;
    const maroon = r.options.find((o) => o.routeId === "maroon")!;
    expect(express.running).toBe(false);
    expect(express.summary).toBe("Tempe-West Valley Express: no service on weekends.");
    expect(maroon).toMatchObject({ running: true, rideMinutes: 60, everyMinutes: 120 });
    expect(r.options[0].routeId).toBe("maroon"); // running routes first
  });

  it("works out when to be at the stop: arrival minus ride minus one full headway", () => {
    const r = shuttleOptions({ from: "tempe", to: "polytechnic", at: MON, arriveBy: "2026-11-16T10:10:00-07:00" });
    expect(r.period).toBe("weekday");
    const gold = r.options[0];
    expect(gold.beAtStopBy).toBe("2026-11-16T09:05:00-07:00");
    expect(gold.summary).toBe(
      "Gold shuttle from Forest Avenue and Lemon Street to SIM Building: about every 15 minutes, about a 50-minute ride. To arrive by 10:10 AM, be at the stop by 9:05 AM.",
    );
  });

  it("never invents a ride time ASU does not publish (Mercado)", () => {
    const r = shuttleOptions({ from: "tempe", to: "downtown", at: MON, arriveBy: "2026-11-16T12:00:00-07:00" });
    const maroon = r.options.find((o) => o.routeId === "maroon")!;
    const mercado = r.options.find((o) => o.routeId === "mercado")!;
    expect(maroon.beAtStopBy).toBe("2026-11-16T11:15:00-07:00");
    expect(mercado.rideMinutes).toBeNull();
    expect(mercado.beAtStopBy).toBeUndefined();
    expect(mercado.summary).toContain("ride time is not published");
    expect(r.options.map((o) => o.routeId)).toEqual(["maroon", "mercado"]); // known ride time first
  });

  it("flags arrivals the shuttle cannot make: before the first or after the last service", () => {
    const early = shuttleOptions({ from: "tempe", to: "polytechnic", at: MON, arriveBy: "2026-11-16T06:30:00-07:00" }).options[0];
    expect(early.beAtStopBy).toBeUndefined();
    expect(early.summary).toContain("The first shuttle leaves Forest Avenue and Lemon Street about 6:00 AM, too late to arrive by 6:30 AM.");
    const late = shuttleOptions({ from: "tempe", to: "polytechnic", at: MON, arriveBy: "2026-11-16T23:50:00-07:00" }).options[0];
    expect(late.beAtStopBy).toBe("2026-11-16T22:30:00-07:00"); // the last service, not later
    expect(late.summary).toContain("Take the last shuttle, about 10:30 PM");
  });

  it("with an arrival time, puts first the route that lets you leave latest", () => {
    const r = shuttleOptions({ from: "tempe", to: "west", at: MON, arriveBy: "2026-11-16T10:00:00-07:00" });
    expect(r.options.map((o) => [o.routeId, o.beAtStopBy])).toEqual([
      ["maroon", "2026-11-16T08:45:00-07:00"], // every 15 min, 60-min ride
      ["tempe-west-express", "2026-11-16T08:10:00-07:00"], // shorter ride, but only hourly
    ]);
  });

  it("returns nothing for a trip within one campus, and knows the campus names", () => {
    expect(shuttleOptions({ from: "tempe", to: "tempe", at: MON }).options).toEqual([]);
    expect(isCampus("polytechnic")).toBe(true);
    expect(isCampus("mesa")).toBe(false);
  });
});

describe("shuttleLeg: two shuttles through Tempe", () => {
  it("plans Polytechnic to Downtown backward: Maroon sets the Tempe stop time, Gold gets there by it", () => {
    const leg = shuttleLeg("polytechnic", "downtown", "2026-11-16T11:20:00-07:00")!;
    // Maroon: 30-minute ride, every 15 → at Forest & Lemon by 10:35. Gold: 50-minute ride, every 15 → at SIM by 9:30.
    expect(leg.beAtStopBy).toBe("2026-11-16T09:30:00-07:00");
    expect(leg.via).toBe(
      "Two shuttles, changing at Forest Avenue and Lemon Street in Tempe. " +
        "Gold shuttle from SIM Building to Forest Avenue and Lemon Street: about every 15 minutes, about a 50-minute ride. To arrive by 10:35 AM, be at the stop by 9:30 AM. " +
        "Then: Maroon shuttle from Forest Avenue and Lemon Street to Central Avenue, north of Polk Street: about every 15 minutes, about a 30-minute ride. To arrive by 11:20 AM, be at the stop by 10:35 AM.",
    );
  });

  it("uses weekend service, every 2 hours, on a Sunday", () => {
    const leg = shuttleLeg("polytechnic", "downtown", "2026-11-15T14:00:00-07:00")!;
    expect(leg.beAtStopBy).toBe("2026-11-15T08:40:00-07:00"); // Maroon 14:00 − 30 − 120 = 11:30; Gold 11:30 − 50 − 120
    expect(leg.via).toContain("To arrive by 11:30 AM, be at the stop by 8:40 AM.");
  });

  it("goes the other way too, and on to West Valley", () => {
    const back = shuttleLeg("downtown", "polytechnic", "2026-11-16T16:00:00-07:00")!;
    expect(back.via).toMatch(/^Two shuttles, changing at Forest Avenue and Lemon Street in Tempe\. (Maroon|Mercado)/);
    expect(back.via).toContain("Then: Gold shuttle from Forest Avenue and Lemon Street to SIM Building");
    expect(back.beAtStopBy).toBeDefined();
    const west = shuttleLeg("polytechnic", "west", "2026-11-16T12:00:00-07:00")!;
    expect(west.via).toContain("Then: Maroon shuttle from Forest Avenue and Lemon Street to");
    expect(Date.parse(west.beAtStopBy!)).toBeLessThan(Date.parse("2026-11-16T12:00:00-07:00") - 115 * 60_000);
  });

  it("says which shuttle does not fit, without a time to be at the stop", () => {
    // Downtown by 7:30: Maroon from Tempe by 6:45, but Gold's first shuttle leaves SIM at 6:00 AM and needs 50 minutes.
    const early = shuttleLeg("polytechnic", "downtown", "2026-11-16T07:30:00-07:00")!;
    expect(early.beAtStopBy).toBeUndefined();
    expect(early.via).toContain("The first shuttle leaves SIM Building about 6:00 AM, too late to arrive by 6:45 AM.");
    expect(early.via).toContain("Then: Maroon shuttle");
    // Downtown by 6:10: not even Maroon can make it.
    const earlier = shuttleLeg("polytechnic", "downtown", "2026-11-16T06:10:00-07:00")!;
    expect(earlier.beAtStopBy).toBeUndefined();
    expect(earlier.via).toMatch(/^Two shuttles, changing at Forest Avenue and Lemon Street in Tempe\. Maroon shuttle .* too late to arrive by 6:10 AM\.$/);
  });

  it("still takes one shuttle when a route goes straight there", () => {
    expect(shuttleLeg("tempe", "polytechnic", "2026-11-16T10:10:00-07:00")).toEqual({
      beAtStopBy: "2026-11-16T09:05:00-07:00",
      via: "Gold shuttle from Forest Avenue and Lemon Street to SIM Building: about every 15 minutes, about a 50-minute ride. To arrive by 10:10 AM, be at the stop by 9:05 AM.",
    });
  });
});
