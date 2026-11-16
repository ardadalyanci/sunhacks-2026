import { describe, expect, it } from "vitest";
import { isCampus, shuttleOptions } from "./shuttles";

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
