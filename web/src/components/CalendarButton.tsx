"use client";

import { useState } from "react";
import type { DayPlan } from "@/lib/types";
import { PRODUCT } from "./brand";

type Props = {
  plan: DayPlan; // the day on screen, without the items the student removed
  name: string;
};

const primary = "rounded-full bg-ink px-4 py-2 font-bold text-cloud hover:bg-ink/90 disabled:opacity-50";
const secondary = "rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10";

/**
 * Puts the day in the student's calendar, with a reminder at each leave time.
 * - With MongoDB, the plan carries `calendarUrl`: a feed of every day the student plans
 *   (GET /api/plan/<calendarId>/calendar, Agent-1). Subscribing once keeps the calendar app in sync.
 * - Without it, or for a one-off, the visible day downloads as an .ics file (POST /api/calendar, Agent-3).
 */
export default function CalendarButton({ plan, name }: Props) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState("");
  const feed = plan.calendarUrl;
  const webcal = feed?.replace(/^https?:/, "webcal:");

  async function download() {
    setWorking(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, name }),
      });
      if (!res.ok) throw new Error(`calendar ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `sundial-${plan.date}.ics`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNote("Downloaded. Open the file to add this day to your calendar.");
    } catch {
      setNote("The calendar file did not download. Try again.");
    } finally {
      setWorking(false);
    }
  }

  async function copy() {
    if (!feed) return;
    try {
      await navigator.clipboard.writeText(feed);
      setNote("Link copied. Paste it where your calendar app asks for a calendar URL.");
    } catch {
      setNote(feed); // clipboard blocked: show the link so it can be copied by hand
    }
  }

  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={secondary}>
        Add to my calendar
      </button>
      {open && (
        <div className="mt-3 max-w-lg rounded-3xl bg-cloud p-4">
          {feed && webcal ? (
            <>
              <p>
                Subscribe once: every day you plan in {PRODUCT} shows up in your calendar, with a reminder at each
                leave time.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={primary}
                >
                  Google Calendar
                </a>
                <a href={webcal} className={secondary}>
                  Apple Calendar
                </a>
                <button type="button" onClick={copy} className={secondary}>
                  Copy link
                </button>
              </div>
              <button
                type="button"
                onClick={download}
                disabled={working}
                className="mt-3 font-bold underline underline-offset-4 disabled:opacity-50"
              >
                {working ? "Making the file…" : "Or download just this day (.ics)"}
              </button>
            </>
          ) : (
            <>
              <p>Download this day and open the file to add it to your calendar, with a reminder at each leave time.</p>
              <button type="button" onClick={download} disabled={working} className={`mt-3 ${primary}`}>
                {working ? "Making the file…" : "Download this day (.ics)"}
              </button>
            </>
          )}
          <p aria-live="polite" className="mt-2 break-all text-sm text-ink-soft">
            {note}
          </p>
        </div>
      )}
    </div>
  );
}
