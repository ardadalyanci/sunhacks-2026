// ASU intercampus shuttles, from ASU's published route pages (shuttles.json).
// ASU publishes how often each route runs, each stop's first and last service time and ride times, not a
// departure list, so this never prints a departure time: everything is "about", and "be at the stop by"
// is the arrival time minus the ride minus one full wait (the worst case for a shuttle every N minutes).
// Weekends use weekend service. Class breaks, summer and holidays are not encoded (dates not published here).
import data from "./shuttles.json";
import { atTime, clock, mstDate, toMstIso, weekdayOf } from "./planner";

export const CAMPUSES = ["tempe", "downtown", "polytechnic", "west"] as const;
export type Campus = (typeof CAMPUSES)[number];
export const isCampus = (v: unknown): v is Campus => typeof v === "string" && (CAMPUSES as readonly string[]).includes(v);

type Period = "weekday" | "weekend";
interface Stop {
  id: string;
  name: string;
  campus: string;
}
interface Route {
  id: string;
  name: string;
  url: string;
  stops: Stop[];
  rideMinutes: { between: string[]; minutes: number }[];
  service: Partial<Record<Period, { everyMinutes: number; windows: Record<string, string[]> }>>;
}

export interface ShuttleOption {
  routeId: string;
  routeName: string;
  routeUrl: string;
  boardAt: string;
  alightAt: string;
  running: boolean; // false: the route has no service on this day
  everyMinutes?: number;
  rideMinutes: number | null; // null: ASU does not publish it for this route
  window?: { first: string; last: string }; // service at the boarding stop, e.g. "9:00 AM"
  beAtStopBy?: string; // ISO -07:00; only with arriveBy, a known ride time and a reachable arrival
  summary: string;
}

export interface ShuttleAnswer {
  from: Campus;
  to: Campus;
  date: string;
  period: Period;
  options: ShuttleOption[];
  note: string;
  trackerUrl: string;
}

const ROUTES = data.routes as unknown as Route[]; // JSON infers per-route window keys; Route is the shape we rely on
const MIN = 60_000;
const NOTE =
  "Approximate: ASU publishes frequencies, not exact departures, and traffic changes times. No service on university holidays; class breaks and summer run less often. Check the live tracker before you go.";

const every = (m: number) => (m % 60 === 0 ? `about every ${m === 60 ? "hour" : `${m / 60} hours`}` : `about every ${m} minutes`);
const shortName = (r: Route) => r.name.match(/\((.+)\)$/)?.[1] ?? r.name;

function rideBetween(route: Route, a: string, b: string): number | null {
  return route.rideMinutes.find((r) => r.between.includes(a) && r.between.includes(b) && a !== b)?.minutes ?? null;
}

function option(route: Route, from: Campus, to: Campus, date: string, period: Period, arriveBy?: Date): ShuttleOption | null {
  const board = route.stops.find((s) => s.campus === from);
  const alight = route.stops.find((s) => s.campus === to);
  if (!board || !alight) return null;
  const base = { routeId: route.id, routeName: route.name, routeUrl: route.url, boardAt: board.name, alightAt: alight.name };
  const rideMinutes = rideBetween(route, from, to);
  const service = route.service[period];
  if (!service) {
    return { ...base, running: false, rideMinutes, summary: `${route.name}: no service on ${period === "weekend" ? "weekends" : "weekdays"}.` };
  }
  const [firstHm, lastHm] = service.windows[board.id];
  const first = atTime(date, firstHm);
  const last = atTime(date, lastHm);
  const window = { first: clock(toMstIso(first)), last: clock(toMstIso(last)) };
  const label = route.id === "gold" || route.id === "maroon" ? `${shortName(route)} shuttle` : `${route.name} shuttle`;
  let summary = `${label} from ${board.name} to ${alight.name}: ${every(service.everyMinutes)}, `;
  summary += rideMinutes === null ? "ride time is not published." : `about a ${rideMinutes}-minute ride.`;
  let beAtStopBy: string | undefined;

  if (arriveBy && rideMinutes !== null) {
    const latestBoard = arriveBy.getTime() - rideMinutes * MIN;
    const arrive = clock(toMstIso(arriveBy));
    if (latestBoard < first.getTime()) {
      summary += ` The first shuttle leaves ${board.name} about ${window.first}, too late to arrive by ${arrive}.`;
    } else {
      const ideal = latestBoard - service.everyMinutes * MIN; // worst case: you just missed one
      const by = new Date(Math.min(Math.max(ideal, first.getTime()), last.getTime()));
      beAtStopBy = toMstIso(by);
      summary +=
        by.getTime() === last.getTime() && ideal > last.getTime()
          ? ` Take the last shuttle, about ${window.last}, to arrive by ${arrive}.`
          : ` To arrive by ${arrive}, be at the stop by ${clock(beAtStopBy)}.`;
    }
  } else if (!arriveBy) {
    summary += ` Runs ${window.first} to ${window.last} today.`;
  }
  return { ...base, running: true, everyMinutes: service.everyMinutes, rideMinutes, window, ...(beAtStopBy ? { beAtStopBy } : {}), summary };
}

/** Shuttle options between two ASU campuses on the day of `arriveBy` (or `at`), running routes first. */
export function shuttleOptions({ from, to, at = new Date(), arriveBy }: { from: Campus; to: Campus; at?: Date; arriveBy?: string }): ShuttleAnswer {
  const arrive = arriveBy ? new Date(arriveBy) : undefined;
  const date = mstDate(arrive ?? at);
  const day = weekdayOf(date);
  const period: Period = day === "Sat" || day === "Sun" ? "weekend" : "weekday";
  const options =
    from === to
      ? []
      : ROUTES.map((r) => option(r, from, to, date, period, arrive))
          .filter((o): o is ShuttleOption => o !== null)
          .sort((a, b) => Number(b.running) - Number(a.running) || (a.rideMinutes ?? Infinity) - (b.rideMinutes ?? Infinity));
  return { from, to, date, period, options, note: NOTE, trackerUrl: data.trackerUrl };
}
