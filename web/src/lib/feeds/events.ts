// Campus events for Sundial: ASU Events (public JSON) + SunDevilCentral (public iCal), Tempe by default (other campuses on request),
// next 7 days, as Opportunity[] (lib/types.ts). Server-only. Each source is cached in memory for 1 hour;
// if a refresh fails we keep serving the last good copy, and one source failing never hides the other.
//
// Feed quirks (checked Nov 14 2026):
// - ASU Events `very_start_date` ends in "Z" but holds Arizona wall time ("9:00am" → "T09:00:00Z").
// - SunDevilCentral DTSTART is real UTC; LOCATION is "Sign in to download the location" for most events.
import { eventInterests } from "./interests";
import { icsUtc, parseIcs, type IcsEvent } from "./ical";
import { CAMPUSES, type Campus } from "../campuses";
import type { Opportunity, OpportunityKind } from "../types";

type EventCampus = NonNullable<Opportunity["campus"]>;
/** The campuses Sundial shows when none are asked for: Tempe (online events are always kept). */
export const DEFAULT_CAMPUSES: readonly Campus[] = ["tempe"];
const keepCampus = (campus: EventCampus | undefined, campuses: readonly Campus[]) =>
  campus === "online" || (campus !== undefined && (campuses as readonly string[]).includes(campus));

export const ASU_EVENTS_URL = "https://asuevents.asu.edu/feed-json/students";
export const SUN_DEVIL_CENTRAL_URL = "https://sundevilcentral.eoss.asu.edu/ical/arizonau/ical_arizonau.ics";

const HOUR = 60 * 60_000;
const CACHE_MS = HOUR;
const WINDOW_DAYS = 7;
const MAX_EVENT_HOURS = 12; // longer "events" are exhibitions or multi-day programs, not something to put on a day
const FETCH_TIMEOUT_MS = 20_000;
const DESCRIPTION_MAX = 280;
const MAX_TAGS = 12; // the plan route keeps 20 tags; setup interests come first (see interests.ts)

// ---------- small text helpers ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

/** HTML → plain text (tags removed, common entities decoded, whitespace squeezed). */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>|<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text: string | undefined, max = DESCRIPTION_MAX): string | undefined {
  if (!text) return undefined;
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** Date → "2026-11-16T13:30:00-07:00". */
export function toArizonaIso(d: Date): string {
  return new Date(d.getTime() - 7 * HOUR).toISOString().slice(0, 19) + "-07:00";
}

/** Best-guess Opportunity kind from the title and feed tags; anything unclear is a club event. */
export function guessKind(title: string, tags: string[]): OpportunityKind {
  const text = `${title} | ${tags.join(" | ")}`;
  if (/\bhackathons?\b|\bhacks?\b.*\b(day|night|weekend)\b/i.test(text)) return "hackathon";
  if (/career fair|job fair|internship fair/i.test(text)) return "career_fair";
  if (/info(rmation)? session|employer|recruit|career|networking/i.test(text)) return "employer_session";
  if (/workshops?\b|training|bootcamp/i.test(text)) return "workshop";
  if (/\bsocial\b|mixer|game night|party|celebration|festival|mingle/i.test(text)) return "social";
  return "club_event";
}


// ---------- ASU Events ----------

interface AsuNode {
  nid?: string;
  title?: string;
  campus?: string;
  locations?: string;
  alias?: string;
  website?: string;
  body_summary?: string;
  full_body?: string;
  start_date?: string; // "Nov 14 2026 - 9:00am"
  end_date?: string;
  very_start_date?: string; // "2026-11-14T09:00:00Z" (Arizona wall time despite the Z)
  very_end_date?: string;
  interests?: string; // "Community|Environment|Students"
  event_topics?: string;
  department?: string;
  college_unit?: string;
}

/** "2026-11-14T09:00:00Z" (wall time) or "Nov 14 2026 - 9:00am" → Date in Arizona time. */
export function parseAsuTime(wall?: string, human?: string): Date | undefined {
  const m = wall?.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?/);
  if (m) return new Date(`${m[1]}${m[2] ?? ":00"}-07:00`);
  const h = human?.match(/^([A-Z][a-z]{2}) (\d{1,2}) (\d{4}) - (\d{1,2}):(\d{2})\s*([ap]m)$/i);
  if (!h) return undefined;
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(h[1].toLowerCase());
  if (month < 0) return undefined;
  let hour = Number(h[4]) % 12;
  if (h[6].toLowerCase() === "pm") hour += 12;
  const pad = (n: number | string) => String(n).padStart(2, "0");
  return new Date(`${h[3]}-${pad(month + 1)}-${pad(h[2])}T${pad(hour)}:${h[5]}:00-07:00`);
}

/** ASU Events' campus field → our campus id. Mesa City Center, SkySong, off campus and the rest → undefined (dropped). */
function asuCampus(campus?: string): EventCampus | undefined {
  if (!campus) return undefined;
  if (/tempe campus/i.test(campus)) return "tempe";
  if (/downtown phoenix/i.test(campus)) return "downtown";
  if (/polytechnic/i.test(campus)) return "polytechnic";
  if (/west valley|west campus/i.test(campus)) return "west";
  if (/online event/i.test(campus)) return "online";
  return undefined;
}

/** Events on `campuses` (default Tempe) plus online ones, each tagged with its campus. */
export function parseAsuEvents(json: unknown, fetchedAt = new Date().toISOString(), campuses: readonly Campus[] = DEFAULT_CAMPUSES): Opportunity[] {
  const nodes = (json as { nodes?: { node?: AsuNode }[] })?.nodes;
  if (!Array.isArray(nodes)) return [];
  const out: Opportunity[] = [];
  for (const { node } of nodes) {
    if (!node?.title || !node.nid) continue;
    const campus = asuCampus(node.campus);
    if (!keepCampus(campus, campuses)) continue;
    const start = parseAsuTime(node.very_start_date, node.start_date);
    if (!start || Number.isNaN(start.getTime())) continue;
    const end = parseAsuTime(node.very_end_date, node.end_date);
    const title = htmlToText(node.title);
    const description = clip(htmlToText(node.body_summary || node.full_body || "")) ?? "";
    const online = /online event/i.test(node.campus ?? "") && !/tempe/i.test(node.campus ?? "");
    const feedTags = [...(node.interests ?? "").split("|"), ...(node.event_topics ?? "").split("|")];
    out.push({
      id: `asu-${node.nid}-${icsUtc(start).slice(0, 13)}`,
      kind: guessKind(title, feedTags),
      title,
      organizer: htmlToText(node.department || node.college_unit?.split(",")[0] || "ASU"),
      description,
      url: node.alias?.replace(/\?id=\d+$/, "") || node.website || "https://asuevents.asu.edu/",
      startsAt: toArizonaIso(start),
      endsAt: end && end > start ? toArizonaIso(end) : undefined,
      location: htmlToText(node.locations ?? "") || (online ? "Online" : undefined),
      tags: eventInterests(feedTags, [title, feedTags.join(" "), description].join(" | ")).slice(0, MAX_TAGS),
      source: "asu_events",
      fetchedAt,
      campus,
    });
  }
  return out;
}

// ---------- SunDevilCentral ----------

const OTHER_CAMPUS = /downtown phoenix|polytechnic|west valley|west campus|mesa city|lake havasu|online event/i;

/**
 * A Tempe tag → Tempe; another campus tag → that campus (Mesa City, Lake Havasu → undefined, dropped); an address
 * in another city with no tag → undefined (a Phoenix address could be Downtown, West Valley or neither); an online
 * tag → online; no campus info (most club meetings) → Tempe.
 */
function sdcCampus(tags: string[], location?: string): EventCampus | undefined {
  if (tags.some((t) => /tempe campus/i.test(t))) return "tempe";
  const other = tags.find((t) => OTHER_CAMPUS.test(t) && !/online event/i.test(t));
  if (other) return /downtown phoenix/i.test(other) ? "downtown" : /polytechnic/i.test(other) ? "polytechnic" : /west valley|west campus/i.test(other) ? "west" : undefined;
  if (location && /\b(phoenix|glendale|mesa|scottsdale|lake havasu)\b/i.test(location) && !/tempe/i.test(location)) return undefined;
  if (tags.some((t) => /online event/i.test(t))) return "online";
  return "tempe";
}

/** "Hayden Library C12, 1151 S Forest Ave, Tempe, AZ 85281, United States" → "Hayden Library C12". Hidden → undefined. */
export function cleanSdcLocation(location?: string): string | undefined {
  const l = location?.trim();
  if (!l || /sign in to (download|view)/i.test(l)) return undefined;
  if (/^online/i.test(l)) return "Online";
  return l.split(",")[0].trim() || undefined;
}

function sdcId(e: IcsEvent, start: Date): string {
  const rsvp = e.url?.match(/[?&]id=(\d+)/)?.[1];
  const base = rsvp ?? (e.uid ?? e.summary).replace(/[^a-z0-9]/gi, "").slice(0, 24);
  return `sdc-${base}-${icsUtc(start).slice(0, 13)}`;
}

/** Events on `campuses` (default Tempe) plus online ones, each tagged with its campus. */
export function parseSunDevilCentral(ics: string, fetchedAt = new Date().toISOString(), campuses: readonly Campus[] = DEFAULT_CAMPUSES): Opportunity[] {
  const out: Opportunity[] = [];
  for (const e of parseIcs(ics)) {
    if (!e.summary || !e.start || e.allDay) continue;
    const feedTags = [...(e.categories.event_type ?? []), ...(e.categories.event_tags ?? []), ...(e.categories[""] ?? [])];
    const campus = sdcCampus(feedTags, e.location);
    if (!keepCampus(campus, campuses)) continue;
    const description = clip(e.description?.replace(/\n?-{3,}\s*\nEvent Details:[\s\S]*$/, "")) ?? "";
    const organizer = e.organizer?.trim() || e.categories.club_acronym?.[0] || "Sun Devil Central";
    out.push({
      id: sdcId(e, e.start),
      kind: guessKind(e.summary, feedTags),
      title: e.summary,
      organizer,
      description,
      url: e.url || "https://sundevilcentral.eoss.asu.edu/events",
      startsAt: toArizonaIso(e.start),
      endsAt: e.end && e.end > e.start ? toArizonaIso(e.end) : undefined,
      location: cleanSdcLocation(e.location),
      tags: eventInterests(feedTags, [e.summary, organizer, feedTags.join(" "), description].join(" | ")).slice(0, MAX_TAGS),
      source: "sundevilcentral",
      fetchedAt,
      campus,
    });
  }
  return out;
}

// ---------- window, merge, cache ----------

/** Events that have not ended yet, start within `days`, and are short enough to put on a day. Sorted by start. */
export function inWindow(events: Opportunity[], now: Date, days = WINDOW_DAYS): Opportunity[] {
  const from = now.getTime();
  const to = from + days * 24 * HOUR;
  const seen = new Set<string>();
  return events
    .filter((e) => {
      const start = e.startsAt ? Date.parse(e.startsAt) : NaN;
      const end = e.endsAt ? Date.parse(e.endsAt) : start + HOUR;
      if (Number.isNaN(start) || end <= from || start >= to) return false;
      if (end - start > MAX_EVENT_HOURS * HOUR) return false;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? "") || a.title.localeCompare(b.title));
}

type SourceKey = "asu_events" | "sundevilcentral";
interface SourceCache {
  events: Opportunity[];
  fetchedAt: number;
  error?: string;
}
// globalThis survives `next dev` hot reloads, so editing code does not refetch 6 MB of iCal every time.
const store = ((globalThis as { __sundialEventCache?: Partial<Record<SourceKey, SourceCache>> }).__sundialEventCache ??= {});
const inflight: Partial<Record<SourceKey, Promise<SourceCache>>> = {};

async function download(url: string, as: "json" | "text"): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Sundial student day planner (hackathon project)", Accept: as === "json" ? "application/json" : "text/calendar" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return as === "json" ? res.json() : res.text();
}

const LOADERS: Record<SourceKey, () => Promise<Opportunity[]>> = {
  // The cache keeps every campus; getEventFeed filters per request.
  asu_events: async () => parseAsuEvents(await download(ASU_EVENTS_URL, "json"), undefined, CAMPUSES),
  sundevilcentral: async () => parseSunDevilCentral(String(await download(SUN_DEVIL_CENTRAL_URL, "text")), undefined, CAMPUSES),
};

async function loadSource(key: SourceKey, nowMs: number): Promise<SourceCache> {
  const cached = store[key];
  if (cached && !cached.error && nowMs - cached.fetchedAt < CACHE_MS) return cached;
  // After a failure, wait 5 minutes before trying again so a dead feed does not slow every request.
  if (cached?.error && nowMs - cached.fetchedAt < 5 * 60_000) return cached;
  inflight[key] ??= LOADERS[key]()
    .then((events) => (store[key] = { events, fetchedAt: Date.now() }))
    .catch((err: unknown) => {
      const error = err instanceof Error ? err.message : String(err);
      // Keep the last good events, but remember the failure time for the retry delay.
      return (store[key] = { events: cached?.events ?? [], fetchedAt: Date.now(), error });
    })
    .finally(() => delete inflight[key]);
  return inflight[key]!;
}

export interface EventFeedResult {
  events: Opportunity[];
  sources: Record<SourceKey, { count: number; fetchedAt: string | null; error?: string }>;
}

/** Events plus how each source did; GET /api/events returns this. */
export async function getEventFeed(options: { now?: Date; days?: number; campuses?: readonly Campus[] } = {}): Promise<EventFeedResult> {
  const campuses = options.campuses?.length ? options.campuses : DEFAULT_CAMPUSES;
  const now = options.now ?? new Date();
  const keys: SourceKey[] = ["asu_events", "sundevilcentral"];
  const results = await Promise.all(keys.map((k) => loadSource(k, Date.now())));
  const sources = {} as EventFeedResult["sources"];
  const all: Opportunity[] = [];
  keys.forEach((k, i) => {
    const r = results[i];
    const events = inWindow(r.events.filter((e) => keepCampus(e.campus, campuses)), now, options.days);
    all.push(...events);
    sources[k] = { count: events.length, fetchedAt: r.fetchedAt && r.events.length ? new Date(r.fetchedAt).toISOString() : null, ...(r.error ? { error: r.error } : {}) };
  });
  return { events: inWindow(all, now, options.days), sources };
}

/** Campus events (default Tempe, plus online) from now through the next 7 days, soonest first. Never throws; an empty list means both feeds are down. */
export async function getEvents(options: { now?: Date; days?: number; campuses?: readonly Campus[] } = {}): Promise<Opportunity[]> {
  return (await getEventFeed(options)).events;
}

/** Test helper: forget cached feeds. */
export function clearEventCache(): void {
  for (const k of Object.keys(store) as SourceKey[]) delete store[k];
}
