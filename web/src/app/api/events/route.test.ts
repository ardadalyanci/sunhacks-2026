import { describe, expect, it, vi } from "vitest";
import type { Opportunity } from "@/lib/types";

const ev = (id: string, tags: string[]): Opportunity => ({ id, kind: "club_event", title: id, organizer: "", description: "", startsAt: "2026-11-16T16:00:00-07:00", url: "u", source: "asu_events", tags, fetchedAt: "t" });
const feed = vi.fn();
vi.mock("@/lib/feeds/events", () => ({ getEventFeed: (o: unknown) => feed(o) }));
const { GET } = await import("./route");

const ok = { asu_events: { count: 2, fetchedAt: "t" }, sundevilcentral: { count: 0, fetchedAt: "t" } };

describe("GET /api/events", () => {
  it("returns { events } and filters by interest", async () => {
    feed.mockResolvedValue({ events: [ev("a", ["robotics"]), ev("b", ["music"])], sources: ok });
    const res = await GET(new Request("http://t/api/events?interest=Robotics&days=3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events.map((e: Opportunity) => e.id)).toEqual(["a"]);
    expect(feed).toHaveBeenLastCalledWith({ days: 3 });
  });

  it("asks the feed for other campuses only when `campus` is given", async () => {
    feed.mockResolvedValue({ events: [], sources: ok });
    await GET(new Request("http://t/api/events?campus=Downtown&campus=polytechnic"));
    expect(feed).toHaveBeenLastCalledWith({ days: 7, campuses: ["downtown", "polytechnic"] });
    expect((await GET(new Request("http://t/api/events?campus=mesa"))).status).toBe(400);
  });

  it("rejects a bad days value", async () => {
    expect((await GET(new Request("http://t/api/events?days=30"))).status).toBe(400);
  });

  it("answers 502 when both feeds are down", async () => {
    feed.mockResolvedValue({ events: [], sources: { asu_events: { count: 0, fetchedAt: null, error: "x" }, sundevilcentral: { count: 0, fetchedAt: null, error: "y" } } });
    expect((await GET(new Request("http://t/api/events"))).status).toBe(502);
  });
});
