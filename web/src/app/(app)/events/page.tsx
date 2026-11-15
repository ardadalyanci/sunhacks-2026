"use client";

import { useState } from "react";
import Mascot from "@/components/Mascot";
import { PRODUCT } from "@/components/brand";
import { formatDay, formatTime, parseLocal } from "@/components/time";
import { useDay } from "@/components/useDay";
import type { EventPick } from "@/lib/types";

const SOURCE = {
  sun_devil_central: "Sun Devil Central",
  asu_events: "ASU Events",
} as const;

export default function EventsPage() {
  const day = useDay();
  const [interest, setInterest] = useState<string>("All");
  const { data, plan } = day;

  if (!data || !plan) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Mascot size={120} animated />
        <p className="mt-4 text-xl font-bold">{day.error || `${PRODUCT} is finding events for you…`}</p>
      </div>
    );
  }

  const onDay = new Set(plan.items.filter((i) => i.kind === "event").map((i) => i.title));
  const groups = new Map<string, EventPick[]>();
  data.picks
    .filter((p) => interest === "All" || p.event.interests.some((i) => i.toLowerCase() === interest.toLowerCase()))
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt))
    .forEach((p) => {
      const date = parseLocal(p.event.startsAt).date;
      groups.set(date, [...(groups.get(date) ?? []), p]);
    });

  return (
    <>
      <h1 className="font-display text-5xl font-bold tracking-tight">Events for you</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-soft">
        From ASU Events and Sun Devil Central for the next 7 days, ranked by your interests and the gaps in your
        schedule.
      </p>

      {data.setup.interests.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter by interest">
          {["All", ...data.setup.interests].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interest === value}
              onClick={() => setInterest(value)}
              className={`rounded-full border-2 px-4 py-1.5 font-bold capitalize ${
                interest === value ? "border-ink bg-ink text-cloud" : "border-ink/20 bg-cloud hover:border-ink"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 max-w-3xl">
        {groups.size === 0 && (
          <p className="text-lg">
            {interest === "All"
              ? "No events yet. They appear here once the ASU Events and Sun Devil Central feeds are connected."
              : `No events match ${interest} this week. Try All.`}
          </p>
        )}
        {[...groups.entries()].map(([date, picks]) => (
          <section key={date} className="mb-8">
            <h2 className="font-display text-2xl font-bold">{formatDay(date)}</h2>
            <ul>
              {picks.map(({ event, why }) => {
                const added = onDay.has(event.title);
                const today = date === plan.date;
                return (
                  <li
                    key={event.id}
                    className="grid gap-3 border-t border-ink/10 py-5 sm:grid-cols-[96px_1fr] sm:items-start"
                  >
                    <p className="font-display text-xl font-bold">{formatTime(parseLocal(event.startsAt).hours)}</p>
                    <div>
                      <h3 className="text-xl font-bold leading-snug">{event.title}</h3>
                      <p className="text-ink-soft">
                        {event.location ?? "Location on the event page"}, from {SOURCE[event.source]}
                      </p>
                      <p className="mt-2 max-w-prose leading-relaxed">{why}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {today && (
                          <button
                            type="button"
                            disabled={day.busy}
                            aria-pressed={added}
                            onClick={() => void (added ? day.removeEvent(event.id) : day.addEvent(event.id))}
                            className={`rounded-full px-4 py-2 font-bold disabled:opacity-50 ${
                              added ? "border-2 border-ink hover:bg-ink/10" : "bg-ink text-cloud hover:bg-ink/90"
                            }`}
                          >
                            {added ? "On your day" : "Add to my day"}
                          </button>
                        )}
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10"
                        >
                          RSVP
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
