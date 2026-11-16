// GET /api/weather?date=YYYY-MM-DD&campus=tempe|downtown|polytechnic|west → Weather { tempF, highF, isHot } (default Tempe) (isHot: feels-like 95 °F or more, 8 AM-8 PM).
// `date` defaults to today in Arizona and can be up to 7 days ahead (tempF is then the noon feels-like). Open-Meteo, cached 30 minutes.
import { isCampus } from "@/lib/campuses";
import { getWeather } from "@/lib/feeds/weather";
import { isCalendarDate } from "@/lib/sanitize";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date");
  const campus = params.get("campus")?.toLowerCase();
  if (campus !== undefined && !isCampus(campus)) return Response.json({ error: "`campus` must be one of: tempe, downtown, polytechnic, west." }, { status: 400 });
  if (date !== null && !isCalendarDate(date)) return Response.json({ error: "`date` must be a real YYYY-MM-DD day." }, { status: 400 });
  const weather = campus ? await getWeather(date ?? undefined, undefined, campus) : await getWeather(date ?? undefined);
  if (!weather) return Response.json({ error: "No forecast for that day (Open-Meteo is unreachable, or the day is more than 7 days away)." }, { status: 502 });
  return Response.json(weather);
}
