// GET /api/demo?date=YYYY-MM-DD&hot=1  →  { persona, request: PlanRequest }
// The UI's "Try the demo" path: POST `request` to /api/plan and render the result. Needs no Canvas token,
// no event feeds and no network. `date` defaults to today in Arizona; a later date is a look-ahead (now = the
// real clock, so /api/plan briefs it as "Tomorrow…"); `hot=1` shows a heat-warning day.
// For the Canvas step of the flow, POST /api/canvas with token "demo" returns the same deadlines.
import { demoScenario } from "@/lib/demo";
import { mstDate, toMstIso } from "@/lib/planner";
import { isCalendarDate } from "@/lib/sanitize";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date");
  if (date !== null && !isCalendarDate(date)) return Response.json({ error: "`date` must be a real YYYY-MM-DD day." }, { status: 400 });
  const hot = params.get("hot") === "1" || params.get("hot") === "true";
  const today = mstDate(new Date());
  const scenario = demoScenario(date ?? today, { hot });
  // Today's demo starts at 8 AM so the whole day shows. A later day is a look-ahead from the real clock.
  if (scenario.request.date! > today) scenario.request.now = toMstIso(new Date());
  return Response.json(scenario);
}
