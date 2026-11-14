// POST /api/plan  PlanRequest  →  DayPlan (engine types, see lib/engine-types.ts)
// The screens call POST /api/day instead, which runs the same pipeline and answers in the UI types.
import { planDay } from "@/lib/dayplan";
import { sanitizePlanRequest } from "@/lib/sanitize";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Send JSON matching PlanRequest in web/src/lib/engine-types.ts." }, { status: 400 });
  }
  const parsed = sanitizePlanRequest(raw);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const { plan } = await planDay(parsed.value);
  return Response.json(plan);
}
