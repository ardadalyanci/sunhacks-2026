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

const FOR_YOU = "For you"; // events that match the student's interests, plus Gemini's picks for today
const ALL = "All";

export default function EventsPage() {
  const day = useDay();
  const [tag, setTag] = useState(FOR_YOU);
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
  const wanted = new Set(interests.map((i) => i.toLowerCase()));
  const forYou = (e: Opportunity) =>
    why.has(`ev-${e.id}`) || onDay.has(`ev-${e.id}`) || e.tags.some((t) => wanted.has(t.toLowerCase()));
  const filter = interests.length > 0 ? tag : ALL; // no interests saved: nothing to match, show everything
  const events = (request.events ?? [])
    .filter((e) => e.startsAt)
    .filter((e) =>
      filter === ALL ? true : filter === FOR_YOU ? forYou(e) : e.tags.some((t) => t.toLowerCase() === filter.toLowerCase()),
    )
    .sort((a, b) => a.startsAt!.localeCompare(b.startsAt!));
  const summary =
    filter === FOR_YOU
      ? `${events.length} events in the next 7 days match your interests.`
      : filter === ALL
        ? `${events.length} events in the next 7 days.`
        : `${events.length} events tagged ${filter}.`;

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
          {[FOR_YOU, ...interests, ALL].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tag === value}
              onClick={() => setTag(value)}
              className={`rounded-full border-2 px-4 py-1.5 font-bold ${value === FOR_YOU || value === ALL ? "" : "capitalize"} ${
                tag === value ? "border-ink bg-ink text-cloud" : "border-ink/20 bg-cloud hover:border-ink"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      {events.length > 0 && <p className="mt-4 text-ink-soft">{summary}</p>}

      <div className="mt-6 max-w-3xl">
        {events.length === 0 && (
          <p className="text-lg">
            {filter === ALL
              ? "No events in the next 7 days. ASU Events and Sun Devil Central may be unreachable right now."
              : filter === FOR_YOU
                ? "No events match your interests this week. Try All."
                : `No events tagged ${filter}. Try All.`}
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
