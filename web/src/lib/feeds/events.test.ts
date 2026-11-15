import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanSdcLocation, clearEventCache, getEventFeed, getEvents, guessKind, htmlToText, inWindow, parseAsuEvents, parseAsuTime, parseSunDevilCentral } from "./events";
import { eventInterests, matchInterests } from "./interests";
import { sanitizePlanRequest } from "../sanitize";
import type { Opportunity } from "../types";

const FETCHED = "2026-11-14T17:00:00.000Z";

const asuNode = (over: Record<string, string> = {}) => ({
  node: {
    nid: "100",
    title: "Robots &amp; Beyond",
    campus: "Tempe campus",
    locations: "Memorial Union",
    department: "Fulton Schools of Engineering",
    alias: "https://asuevents.asu.edu/event/robots-beyond?id=0",
    body_summary: "<p>Build a robot with us&nbsp;tonight.</p>",
    start_date: "Nov 16 2026 - 4:00pm",
    end_date: "Nov 16 2026 - 5:30pm",
    very_start_date: "2026-11-16T16:00:00Z",
    very_end_date: "2026-11-16T17:30:00Z",
    interests: "Engineering|Students|Technology",
    ...over,
  },
});

const sdcIcs = (events: string[][]) => ["BEGIN:VCALENDAR", ...events.flatMap((e) => ["BEGIN:VEVENT", ...e, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");
const sdcEvent = (over: Record<string, string> = {}) => {
  const base: Record<string, string> = {
    UID: "abc@campusgroups.com",
    'ORGANIZER;CN="Drone Club at ASU"': "mailto:noreply@x",
    "CATEGORIES;X-CG-CATEGORY=event_type": "Meeting",
    "CATEGORIES;X-CG-CATEGORY=event_tags": "Tempe Campus,In-Person Event",
    DTSTART: "20261116T230000Z",
    DTEND: "20261117T000000Z",
    SUMMARY: "Weekly build session",
    LOCATION: " Sign in to download the location",
    URL: "https://sundevilcentral.eoss.asu.edu/rsvp?id=4242",
    DESCRIPTION: "Fly and fix quadcopters.\\n\\n---\\nEvent Details: https://sundevilcentral.eoss.asu.edu/rsvp?id=4242",
    ...over,
  };
  return Object.entries(base).map(([k, v]) => `${k}:${v}`);
};

describe("ASU Events", () => {
  it("reads the wall-clock time even though the feed marks it Z", () => {
    expect(parseAsuTime("2026-11-16T16:00:00Z")?.toISOString()).toBe("2026-11-16T23:00:00.000Z");
    expect(parseAsuTime(undefined, "Nov 16 2026 - 12:30pm")?.toISOString()).toBe("2026-11-16T19:30:00.000Z");
    expect(parseAsuTime(undefined, "Nov 16 2026 - 12:05am")?.toISOString()).toBe("2026-11-16T07:05:00.000Z");
  });

  it("maps a node to an Opportunity with clean text, Arizona times and setup interests first", () => {
    const [e] = parseAsuEvents({ nodes: [asuNode()] }, FETCHED);
    expect(e).toEqual({
      id: "asu-100-20261116T2300",
      kind: "club_event",
      title: "Robots & Beyond",
      organizer: "Fulton Schools of Engineering",
      description: "Build a robot with us tonight.",
      url: "https://asuevents.asu.edu/event/robots-beyond",
      startsAt: "2026-11-16T16:00:00-07:00",
      endsAt: "2026-11-16T17:30:00-07:00",
      location: "Memorial Union",
      tags: ["robotics", "Engineering", "Technology"],
      source: "asu_events",
      fetchedAt: FETCHED,
    });
  });

  it("keeps Tempe and online events and drops other campuses", () => {
    const events = parseAsuEvents({
      nodes: [
        asuNode({ nid: "1", campus: "Tempe campus" }),
        asuNode({ nid: "2", campus: "Online event", locations: "" }),
        asuNode({ nid: "3", campus: "West Valley campus" }),
        asuNode({ nid: "4", campus: "Downtown Phoenix campus" }),
        asuNode({ nid: "5", title: "" }),
      ],
    });
    expect(events.map((e) => e.id.split("-")[1])).toEqual(["1", "2"]);
    expect(events[1].location).toBe("Online");
  });

  it("returns [] for an unexpected shape", () => {
    expect(parseAsuEvents(null)).toEqual([]);
    expect(parseAsuEvents({ nodes: "nope" })).toEqual([]);
  });
});

describe("SunDevilCentral", () => {
  it("maps a VEVENT, hides the sign-in location and trims the details link", () => {
    const [e] = parseSunDevilCentral(sdcIcs([sdcEvent()]), FETCHED);
    expect(e).toMatchObject({
      id: "sdc-4242-20261116T2300",
      title: "Weekly build session",
      organizer: "Drone Club at ASU",
      description: "Fly and fix quadcopters.",
      startsAt: "2026-11-16T16:00:00-07:00",
      endsAt: "2026-11-16T17:00:00-07:00",
      url: "https://sundevilcentral.eoss.asu.edu/rsvp?id=4242",
      source: "sundevilcentral",
      fetchedAt: FETCHED,
    });
    expect(e.location).toBeUndefined();
    expect(e.tags[0]).toBe("robotics"); // from "Drone Club"
    expect(e.tags).not.toContain("Tempe Campus");
  });

  it("drops events tagged only for another campus, and all-day events", () => {
    const events = parseSunDevilCentral(
      sdcIcs([
        sdcEvent({ "CATEGORIES;X-CG-CATEGORY=event_tags": "Polytechnic Campus" }),
        sdcEvent({ "CATEGORIES;X-CG-CATEGORY=event_tags": "In-Person Event", URL: "https://x/rsvp?id=1" }),
        sdcEvent({ "DTSTART;VALUE=DATE": "20261116", DTSTART: "", URL: "https://x/rsvp?id=2" }),
      ]),
    );
    expect(events.map((e) => e.id)).toEqual(["sdc-1-20261116T2300"]);
  });

  it("shortens addresses", () => {
    expect(cleanSdcLocation("Hayden Library C12, 1151 S Forest Ave, Tempe, AZ 85281, United States")).toBe("Hayden Library C12");
    expect(cleanSdcLocation("Online Event")).toBe("Online");
    expect(cleanSdcLocation(" Sign in to download the location")).toBeUndefined();
  });

  it("produces events that pass /api/plan's input check unchanged", () => {
    const events = parseSunDevilCentral(sdcIcs([sdcEvent()]), FETCHED);
    const parsed = sanitizePlanRequest({ classes: [], events });
    expect(parsed.ok && parsed.value.events).toEqual(events.map((e) => ({ ...e, location: undefined })));
  });
});

describe("interests and kinds", () => {
  it("matches setup interests on whole words only", () => {
    expect(matchInterests("Drone racing night")).toEqual(["robotics"]);
    expect(matchInterests("Start your day")).toEqual([]); // "art" inside "Start" is not arts
    expect(matchInterests("Resume review with recruiters")).toEqual(["career"]);
    expect(matchInterests("DevFest Phoenix x SunHacks")).toEqual(["hackathons"]);
  });

  it("puts setup interests first, dedupes and drops location noise", () => {
    expect(eventInterests(["Performance", "Tempe Campus", "Free"], "Jazz night")).toEqual(["music", "Performance"]);
  });

  it("guesses the kind", () => {
    expect(guessKind("Spring career fair", [])).toBe("career_fair");
    expect(guessKind("Intro to Git workshop", [])).toBe("workshop");
    expect(guessKind("Devfest x Sunhacks", ["Hackathon"])).toBe("hackathon");
    expect(guessKind("Board game mixer", ["Social"])).toBe("social");
    expect(guessKind("General meeting", ["Meeting"])).toBe("club_event");
  });
});

describe("window", () => {
  const ev = (id: string, startsAt: string, endsAt?: string): Opportunity => ({ id, kind: "club_event", title: id, organizer: "", description: "", startsAt, endsAt, url: "u", source: "asu_events", tags: [], fetchedAt: FETCHED });
  const now = new Date("2026-11-14T12:00:00-07:00");

  it("keeps events that have not ended, start within 7 days and last 12 h or less", () => {
    const kept = inWindow(
      [
        ev("later", "2026-11-16T10:00:00-07:00"),
        ev("ended", "2026-11-14T08:00:00-07:00", "2026-11-14T09:00:00-07:00"),
        ev("ongoing", "2026-11-14T11:00:00-07:00", "2026-11-14T13:00:00-07:00"),
        ev("too-far", "2026-11-22T10:00:00-07:00"),
        ev("exhibit", "2026-11-14T13:00:00-07:00", "2026-11-20T13:00:00-07:00"),
        ev("later", "2026-11-16T10:00:00-07:00"),
      ],
      now,
    );
    expect(kept.map((e) => e.id)).toEqual(["ongoing", "later"]);
  });
});

describe("getEvents", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const now = new Date("2026-11-15T09:00:00-07:00");

  beforeEach(() => {
    clearEventCache();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const respond = (asu: () => Response, sdc: () => Response) =>
    fetchMock.mockImplementation(async (url: string) => (url.includes("asuevents") ? asu() : sdc()));

  it("merges both feeds sorted by time and caches them", async () => {
    respond(
      () => Response.json({ nodes: [asuNode()] }),
      () => new Response(sdcIcs([sdcEvent({ DTSTART: "20261116T200000Z", DTEND: "20261116T210000Z" })])),
    );
    const events = await getEvents({ now });
    expect(events.map((e) => e.source)).toEqual(["sundevilcentral", "asu_events"]);
    await getEvents({ now });
    expect(fetchMock).toHaveBeenCalledTimes(2); // second call served from cache
  });

  it("serves the other feed when one fails, and reports the error", async () => {
    respond(
      () => new Response("down", { status: 503 }),
      () => new Response(sdcIcs([sdcEvent()])),
    );
    const feed = await getEventFeed({ now });
    expect(feed.events).toHaveLength(1);
    expect(feed.sources.asu_events).toMatchObject({ count: 0, error: "HTTP 503" });
    expect(feed.sources.sundevilcentral.count).toBe(1);
  });

  it("never throws when the network is gone", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(getEvents({ now })).resolves.toEqual([]);
  });
});

it("htmlToText decodes entities", () => {
  expect(htmlToText("<p>Tom&#39;s &amp; Jerry&rsquo;s<br/>show</p>")).toBe("Tom's & Jerry’s show");
});
