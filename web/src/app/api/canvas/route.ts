// POST /api/canvas  { token: string, date?: "YYYY-MM-DD" }  →  { date, deadlines: DayItem[] }
// Deadlines run from `date` (default: today in Arizona) to the end of the next day.
// The token comes from the student (Canvas → Account → Settings → New Access Token) and is never stored or logged.
import { CanvasError, fetchDeadlines } from "@/lib/canvas";
import { mstDate } from "@/lib/planner";

export async function POST(request: Request) {
  let body: { token?: unknown; date?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON: { token, date? }." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 300) return Response.json({ error: "A Canvas access token is required." }, { status: 400 });

  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : mstDate(new Date());

  try {
    const deadlines = await fetchDeadlines(token, date);
    return Response.json({ date, deadlines });
  } catch (err) {
    if (err instanceof CanvasError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Could not reach Canvas." }, { status: 502 });
  }
}
