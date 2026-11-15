// GET /api/plan/<calendarId>/calendar → every day saved under that calendar id (MongoDB Atlas) as one .ics.
// Google Calendar ("From URL") and Apple Calendar ("New Calendar Subscription") poll this URL, so the
// student's planned days and leave-time reminders show up in their own calendar. The id is a random UUID
// made in the browser; the feed holds course and assignment titles, so it is never listed or guessable.
import { isCalendarId } from "@/lib/sanitize";
import { calendarIcs, loadPlans } from "@/lib/saved-plans";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isCalendarId(id)) return Response.json({ error: "Unknown calendar." }, { status: 404 });
  const days = await loadPlans(id);
  if (days === null) return Response.json({ error: "Calendar feeds need the database, which is not reachable right now." }, { status: 503 });
  if (!days.length) return Response.json({ error: "Nothing planned for this calendar in the last day or the days ahead." }, { status: 404 });
  return new Response(calendarIcs(days), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="daypilot.ics"',
      "Cache-Control": "no-store",
    },
  });
}
