"use client";

import { useMemo, useState } from "react";
import { formatDay, formatTime, parseLocal } from "@/components/time";
import type { EventPick } from "@/lib/types";
import { demoPicks, demoSetup } from "@/mocks/day";

const SOURCE = {
  sun_devil_central: "Sun Devil Central",
  asu_events: "ASU Events",
} as const;

export default function EventsPage() {
  const [interest, setInterest] = useState<string>("All");
  const [saved, setSaved] = useState<Set<string>>(() => new Set(["ev-robotics"]));

  const byDay = useMemo(() => {
    const groups = new Map<string, EventPick[]>();
    demoPicks
      .filter((p) => interest === "All" || p.event.interests.includes(interest))
      .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt))
      .forEach((p) => {
        const date = parseLocal(p.event.startsAt).date;
        groups.set(date, [...(groups.get(date) ?? []), p]);
      });
    return [...groups.entries()];
  }, [interest]);

  function toggle(id: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <h1 className="font-display text-5xl font-bold tracking-tight">Events for you</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-soft">
        From ASU Events and Sun Devil Central for the next 7 days, ranked by your interests and the gaps in
        your schedule.
      </p>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter by interest">
        {["All", ...demoSetup.interests].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={interest === value}
            onClick={() => setInterest(value)}
            className={`rounded-full border-2 px-4 py-1.5 font-bold ${
              interest === value ? "border-ink bg-ink text-cloud" : "border-ink/20 bg-cloud hover:border-ink"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="mt-8 max-w-3xl">
        {byDay.length === 0 && <p className="text-lg">No events match {interest} this week. Try All.</p>}
        {byDay.map(([date, picks]) => (
          <section key={date} className="mb-8">
            <h2 className="font-display text-2xl font-bold">{formatDay(date)}</h2>
            <ul>
              {picks.map(({ event, why }) => {
                const isSaved = saved.has(event.id);
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
                        <button
                          type="button"
                          aria-pressed={isSaved}
                          onClick={() => toggle(event.id)}
                          className={`rounded-full px-4 py-2 font-bold ${
                            isSaved ? "border-2 border-ink hover:bg-ink/10" : "bg-ink text-cloud hover:bg-ink/90"
                          }`}
                        >
                          {isSaved ? "In your plan" : "Add to my plan"}
                        </button>
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
