// POST /api/calendar { plan: DayPlan, name? } → the planned day as an .ics download (text/calendar).
// The UI sends the DayPlan it got from POST /api/plan; Google or Apple Calendar can import the file.
// Each class or event with a leave time gets a reminder at that time. Submitted deadlines are left out.
import { buildDayIcs } from "@/lib/feeds/calendar";
import { isCalendarDate } from "@/lib/sanitize";
import type { DayItem, DayPlan } from "@/lib/types";

const TYPES = new Set(["class", "deadline", "event", "study_block", "travel"]);
const MAX_ITEMS = 200;

function cleanItem(v: unknown): DayItem | null {
  if (!v || typeof v !== "object") return null;
  const i = v as Record<string, unknown>;
  const text = (x: unknown, max: number) => (typeof x === "string" && x.trim() && x.length <= max ? x.trim() : undefined);
  const iso = (x: unknown) => (typeof x === "string" && x.length <= 40 && !Number.isNaN(Date.parse(x)) ? x : undefined);
  const id = text(i.id, 200);
  const title = text(i.title, 300);
  const start = iso(i.start);
  if (!id || !title || !start || typeof i.type !== "string" || !TYPES.has(i.type)) return null;
  const url = text(i.url, 2000);
  return {
    id,
    type: i.type as DayItem["type"],
    title,
    start,
    end: iso(i.end),
    buildingId: text(i.buildingId, 40),
    location: text(i.location, 300),
    source: "planner",
    done: i.done === true,
    url: url && /^https?:\/\//i.test(url) ? url : undefined,
    leaveAt: iso(i.leaveAt),
    why: text(i.why, 500),
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON: { plan: DayPlan }." }, { status: 400 });
  }
  const raw = (body as { plan?: Partial<DayPlan>; name?: unknown } | null)?.plan;
  if (!raw || typeof raw !== "object" || !isCalendarDate(raw.date) || !Array.isArray(raw.items)) {
    return Response.json({ error: "`plan` must be the DayPlan from /api/plan (with `date` and `items`)." }, { status: 400 });
  }
  if (raw.items.length > MAX_ITEMS) return Response.json({ error: "That plan has too many items." }, { status: 400 });

  const plan: DayPlan = {
    date: raw.date,
    items: raw.items.map(cleanItem).filter((i): i is DayItem => i !== null),
    suggestions: [],
    weather: raw.weather && typeof raw.weather === "object" ? raw.weather : undefined,
    briefing: "",
    aiUsed: false,
  };
  const name = typeof (body as { name?: unknown }).name === "string" ? (body as { name: string }).name.trim().slice(0, 40) : "";
  const ics = buildDayIcs(plan, { calendarName: name ? `DayPilot: ${name}` : "DayPilot" });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="daypilot-${plan.date}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
