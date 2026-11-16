// GET /api/events?days=7&interest=robotics&campus=downtown
// → { events: Opportunity[], sources: { asu_events: { count, fetchedAt, error? }, sundevilcentral: {...} }, fetchedAt }
// Campus events from ASU Events + SunDevilCentral, from now through `days` (1-7, default 7), soonest first.
// `campus` (repeatable: tempe, downtown, polytechnic, west) picks the campuses; default Tempe. Online events are always in.
// `interest` (repeatable) keeps only events tagged with one of those interests. Feeds are cached 1 h in memory.
// The UI (components/useDay.ts) reads `events` and passes them to POST /api/plan.
import { isCampus } from "@/lib/campuses";
import { getEventFeed } from "@/lib/feeds/events";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const daysRaw = params.get("days");
  const days = daysRaw === null ? 7 : Number(daysRaw);
  if (!Number.isInteger(days) || days < 1 || days > 7) return Response.json({ error: "`days` must be a whole number from 1 to 7." }, { status: 400 });
  const interests = params.getAll("interest").map((i) => i.trim().toLowerCase()).filter(Boolean);

  const campuses = params.getAll("campus").map((c) => c.trim().toLowerCase());
  if (!campuses.every(isCampus)) return Response.json({ error: "`campus` must be one of: tempe, downtown, polytechnic, west." }, { status: 400 });

  const feed = await getEventFeed(campuses.length ? { days, campuses } : { days });
  const events = interests.length ? feed.events.filter((e) => e.tags.some((t) => interests.includes(t.toLowerCase()))) : feed.events;
  const bothDown = Object.values(feed.sources).every((s) => s.error && s.count === 0);
  return Response.json({ events, sources: feed.sources, fetchedAt: new Date().toISOString() }, { status: bothDown ? 502 : 200 });
}
