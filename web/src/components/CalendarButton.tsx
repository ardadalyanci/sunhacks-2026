"use client";

import { useState } from "react";
import type { DayPlan } from "@/lib/types";

type Props = {
  plan: DayPlan; // the day on screen, without the items the student removed
  name: string;
};

/**
 * Downloads the planned day as an .ics file from POST /api/calendar (Agent-3). Google Calendar, Apple
 * Calendar and Outlook can import it, with a reminder at each leave time.
 */
export default function CalendarButton({ plan, name }: Props) {
  const [state, setState] = useState<"idle" | "working" | "saved" | "failed">("idle");

  async function download() {
    setState("working");
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
      link.download = `daypilot-${plan.date}.ics`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("saved");
    } catch {
      setState("failed");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={download}
        disabled={state === "working"}
        className="rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10 disabled:opacity-50"
      >
        {state === "working" ? "Making the calendar file…" : "Add to my calendar"}
      </button>
      <p aria-live="polite" className="mt-2 text-sm text-ink-soft">
        {state === "saved" && "Downloaded. Open the file to add this day to your calendar, with a reminder at each leave time."}
        {state === "failed" && "The calendar file did not download. Try again."}
      </p>
    </div>
  );
}
