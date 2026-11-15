"use client";

import { useState } from "react";
import Mascot from "@/components/Mascot";
import { PRODUCT } from "@/components/brand";
import { formatDay, formatTime, parseLocal } from "@/components/time";
import { useDay } from "@/components/useDay";
import type { Opportunity } from "@/lib/types";

const SOURCE: Partial<Record<Opportunity["source"], string>> = {
  asu_events: "ASU Events",
  sundevilcentral: "Sun Devil Central",
};

export default function EventsPage() {
  const day = useDay();
  const [tag, setTag] = useState("All");
  const { plan, request } = day;

  if (!plan || !request) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Mascot size={120} animated />
        <p className="mt-4 text-xl font-bold">{day.error || `${PRODUCT} is finding events for you…`}</p>
      </div>
    );
  }

  const why = new Map(plan.suggestions.map((s) => [s.id, s.why]));
  const onDay = new Set(plan.items.filter((i) => i.type === "event").map((i) => i.id));
  const interests = request.interests ?? [];
  const events = (request.events ?? [])
    .filter((e) => e.startsAt)
    .filter((e) => tag === "All" || e.tags.some((t) => t.toLowerCase() === tag.toLowerCase()))
    .sort((a, b) => a.startsAt!.localeCompare(b.startsAt!));

  const byDay = new Map<string, Opportunity[]>();
  for (const e of events) {
    const date = parseLocal(e.startsAt!).date;
    byDay.set(date, [...(byDay.get(date) ?? []), e]);
  }

  return (
    <>
      <h1 className="font-display text-5xl font-bold tracking-tight">Events for you</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-soft">
        From ASU Events and Sun Devil Central, ranked against your interests and the free time in your day.
      </p>

      {interests.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter by interest">
          {["All", ...interests].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tag === value}
              onClick={() => setTag(value)}
              className={`rounded-full border-2 px-4 py-1.5 font-bold capitalize ${
                tag === value ? "border-ink bg-ink text-cloud" : "border-ink/20 bg-cloud hover:border-ink"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 max-w-3xl">
        {events.length === 0 && (
          <p className="text-lg">
            {tag === "All"
              ? "No events yet. They appear here once the ASU Events and Sun Devil Central feeds are connected."
              : `No events tagged ${tag}. Try All.`}
          </p>
        )}
        {[...byDay.entries()].map(([date, list]) => (
          <section key={date} className="mb-8">
            <h2 className="font-display text-2xl font-bold">{formatDay(date)}</h2>
            <ul>
              {list.map((e) => {
                const itemId = `ev-${e.id}`;
                const added = onDay.has(itemId);
                const today = date === plan.date;
                return (
                  <li key={e.id} className="grid gap-3 border-t border-ink/10 py-5 sm:grid-cols-[96px_1fr] sm:items-start">
                    <p className="font-display text-xl font-bold">{formatTime(parseLocal(e.startsAt!).hours)}</p>
                    <div>
                      <h3 className="text-xl font-bold leading-snug">{e.title}</h3>
                      <p className="text-ink-soft">
                        {e.location ?? "Location on the event page"}
                        {SOURCE[e.source] ? `, from ${SOURCE[e.source]}` : ""}
                      </p>
                      <p className="mt-2 max-w-prose leading-relaxed">{why.get(itemId) ?? e.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {today && (
                          <button
                            type="button"
                            disabled={day.busy}
                            aria-pressed={added}
                            onClick={() => void (added ? day.unaccept(itemId) : day.accept(itemId))}
                            className={`rounded-full px-4 py-2 font-bold disabled:opacity-50 ${
                              added ? "border-2 border-ink hover:bg-ink/10" : "bg-ink text-cloud hover:bg-ink/90"
                            }`}
                          >
                            {added ? "On your day" : "Add to my day"}
                          </button>
                        )}
                        <a
                          href={e.url}
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
