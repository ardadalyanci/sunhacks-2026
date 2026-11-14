"use client";

// Both buttons subscribe to the same ICS feed that the backend serves at /api/calendar/[studentId].
// Google Calendar can only fetch it once the app is deployed on a public URL.
export default function CalendarButtons({ studentId }: { studentId: string }) {
  function feedUrl() {
    return `webcal://${window.location.host}/api/calendar/${studentId}`;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() =>
          window.open(
            `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feedUrl())}`,
            "_blank",
            "noopener",
          )
        }
        className="rounded-full bg-ink px-5 py-3 font-bold text-cloud hover:bg-ink/90"
      >
        Add to Google Calendar
      </button>
      <button
        type="button"
        onClick={() => {
          window.location.href = feedUrl();
        }}
        className="rounded-full border-2 border-ink px-5 py-3 font-bold hover:bg-ink/10"
      >
        Add to Apple Calendar
      </button>
    </div>
  );
}
