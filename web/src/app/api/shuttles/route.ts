// GET /api/shuttles?from=tempe&to=polytechnic&arriveBy=2026-11-16T10:10:00-07:00
// ASU intercampus shuttle options between two campuses (tempe, downtown, polytechnic, west), from ASU's
// published route pages: route, boarding stop, how often it runs, ride time, today's service at the stop and,
// with arriveBy, when to be at the stop. Approximate by design: ASU publishes no departure list.
import { isCampus, shuttleOptions } from "@/lib/shuttles";

const iso = (v: string | null) => (v !== null && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : undefined);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = params.get("from")?.toLowerCase();
  const to = params.get("to")?.toLowerCase();
  if (!isCampus(from) || !isCampus(to)) {
    return Response.json({ error: "`from` and `to` must each be one of: tempe, downtown, polytechnic, west." }, { status: 400 });
  }
  const arriveBy = params.get("arriveBy");
  const at = params.get("at");
  if ((arriveBy !== null && !iso(arriveBy)) || (at !== null && !iso(at))) {
    return Response.json({ error: "`arriveBy` and `at` must be ISO dates, like 2026-11-16T10:10:00-07:00." }, { status: 400 });
  }
  return Response.json(shuttleOptions({ from, to, at: at ? new Date(at) : new Date(), arriveBy: arriveBy ?? undefined }));
}
