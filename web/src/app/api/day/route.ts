// POST /api/day: the one call the screens make. Request and response use the public types in lib/types.ts.
//
// Body: { setup?: StudentSetup, canvasToken?: string, demo?: boolean, date?: "YYYY-MM-DD", now?: ISO,
//         acceptedEventIds?: string[], previewHot?: boolean }
// Answer: { demo, setup, plan: DayPlan, dueSoon: DayItem[], picks: EventPick[] }
//
// Demo mode (demo: true, the token "demo", or no usable setup) uses lib/demo.ts and needs no network.
// Otherwise deadlines come from Canvas with the student's token (never stored or logged). Events and
// weather come from Agent-3's lib/feeds once it lands; until then a real day has no events or weather.
import { CanvasError, fetchDeadlines } from "@/lib/canvas";
import { planDay } from "@/lib/dayplan";
import { DEMO_PERSONA, DEMO_TOKEN, demoDeadlines, demoEvents, demoSetup, demoWeather } from "@/lib/demo";
import type { DayItem as EngineItem, Opportunity } from "@/lib/engine-types";
import { atTime, mstDate, opportunityToItem, toMstIso } from "@/lib/planner";
import { isCalendarDate, sanitizePlanRequest, sanitizeSetup } from "@/lib/sanitize";
import type { DayPlan, StudentSetup, Weather } from "@/lib/types";
import { engineClasses, engineWeather, heatAlert, uiDueSoon, uiItems, uiPicks } from "@/lib/ui-adapter";

export async function POST(request: Request) {
  let body: Record<string, unknown> | null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON: { setup, canvasToken?, demo?, acceptedEventIds?, previewHot? }." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return Response.json({ error: "Send a JSON object." }, { status: 400 });
  if (body.date !== undefined && !isCalendarDate(body.date)) return Response.json({ error: "`date` must be a real YYYY-MM-DD day." }, { status: 400 });

  const token = typeof body.canvasToken === "string" ? body.canvasToken.trim() : "";
  if (token.length > 300) return Response.json({ error: "That Canvas token is too long." }, { status: 400 });
  const studentSetup = sanitizeSetup(body.setup);
  const demo = body.demo === true || token === DEMO_TOKEN || !studentSetup;
  const date = isCalendarDate(body.date) ? body.date : mstDate(new Date());
  const setup: StudentSetup = studentSetup ?? demoSetup(date);
  // A demo day starts at 8 AM so the whole day shows; a real day plans from the current time.
  const now = typeof body.now === "string" && !Number.isNaN(Date.parse(body.now)) ? body.now : demo ? toMstIso(atTime(date, "08:00")) : toMstIso(new Date());

  // Deadlines: Canvas with the student's token, the demo set, or none.
  let deadlines: EngineItem[] = [];
  if (token && token !== DEMO_TOKEN) {
    try {
      deadlines = await fetchDeadlines(token, date);
    } catch (err) {
      if (err instanceof CanvasError) return Response.json({ error: err.message }, { status: err.status });
      return Response.json({ error: "Could not reach Canvas." }, { status: 502 });
    }
  } else if (demo) {
    deadlines = demoDeadlines(date);
  }

  // Events and weather. TODO(Agent-1): call Agent-3's getEvents() / getWeather() from lib/feeds when they land.
  const events: Opportunity[] = demo ? demoEvents(date) : [];
  const weather: Weather | undefined = body.previewHot === true ? demoWeather(date, true) : demo ? demoWeather(date) : undefined;

  const parsed = sanitizePlanRequest({
    date,
    now,
    classes: engineClasses(setup.classes),
    deadlines,
    events,
    acceptedEventIds: (Array.isArray(body.acceptedEventIds) ? body.acceptedEventIds : [])
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.replace(/^event-/, "")),
    interests: setup.interests,
    weather: engineWeather(weather),
    startBuildingId: demo && !studentSetup ? DEMO_PERSONA.startBuildingId : undefined,
  });
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const { plan: enginePlan, deadlines: withEstimates } = await planDay(parsed.value);
  const items = uiItems(enginePlan);
  const plan: DayPlan = { date, items, heatAlert: heatAlert(items, weather), briefing: enginePlan.briefing };

  const weekEnd = Date.parse(toMstIso(atTime(date, "00:00"))) + 7 * 24 * 60 * 60_000;
  const later = events
    .map((o) => opportunityToItem(o, []))
    .filter((e): e is EngineItem => e !== null && mstDate(new Date(e.start)) > date && Date.parse(e.start) < weekEnd);

  return Response.json({
    demo,
    setup,
    plan,
    dueSoon: uiDueSoon(withEstimates, date),
    picks: uiPicks(enginePlan.suggestions, later, setup.interests),
  });
}
