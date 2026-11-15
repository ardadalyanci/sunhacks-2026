// GET /api/weather?date=YYYY-MM-DD → Weather { tempF, highF, isHot } for Tempe (isHot: feels-like 95 °F or more, 8 AM-8 PM).
// `date` defaults to today in Arizona and can be up to 7 days ahead (tempF is then the noon feels-like). Open-Meteo, cached 30 minutes.
import { getWeather } from "@/lib/feeds/weather";
import { isCalendarDate } from "@/lib/sanitize";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  if (date !== null && !isCalendarDate(date)) return Response.json({ error: "`date` must be a real YYYY-MM-DD day." }, { status: 400 });
  const weather = await getWeather(date ?? undefined);
  if (!weather) return Response.json({ error: "No forecast for that day (Open-Meteo is unreachable, or the day is more than 7 days away)." }, { status: 502 });
  return Response.json(weather);
}
