"use client";

import { useState } from "react";
import Mascot from "@/components/Mascot";
import { MASCOT, PRODUCT } from "@/components/brand";
import { cleanDescription, fitOnDay } from "@/components/event-fit";
import { rangeLabel } from "@/components/sky-layout";
import { formatDay, formatTime, parseLocal } from "@/components/time";
import { useDay } from "@/components/useDay";
import { placeLabel } from "@/lib/places";
import type { Opportunity } from "@/lib/types";

const SOURCE: Partial<Record<Opportunity["source"], string>> = {
  asu_events: "ASU Events",
  sundevilcentral: "Sun Devil Central",
  seed: "the sample day",
};

const FOR_YOU = "For you"; // events that match the student's interests, plus Gemini's picks for today
const ALL = "All";

const clock = (iso: string) => formatTime(parseLocal(iso).hours);

/** Where an event is, in the words students use; Sun Devil Central hides rooms from the public feed. */
function whereText(e: Opportunity) {
  if (e.location) return placeLabel(e.location);
  return e.source === "sundevilcentral" ? "Room’s on Sun Devil Central (log in to see it)" : "Location on the event page";
}

/** Sol's reason line: his face, then why this fits, in bold. */
function Reason({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 font-bold leading-snug">
      <Mascot size={22} label="" className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </p>
  );
}

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
  const all = (request.events ?? []).filter((e) => e.startsAt);
  const events = all
    .filter((e) =>
      filter === ALL ? true : filter === FOR_YOU ? forYou(e) : e.tags.some((t) => t.toLowerCase() === filter.toLowerCase()),
    )
    .sort((a, b) => a.startsAt!.localeCompare(b.startsAt!));
  const summary =
    filter === FOR_YOU
      ? `${events.length} match what you picked.`
      : filter === ALL
        ? `${events.length} events this week.`
        : `${events.length} tagged ${filter}.`;

  const byDay = new Map<string, Opportunity[]>();
  for (const e of events) {
    const date = parseLocal(e.startsAt!).date;
    byDay.set(date, [...(byDay.get(date) ?? []), e]);
  }

  function addButton(itemId: string) {
    const added = onDay.has(itemId);
    return (
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
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
      <div className="min-w-0">
        <h1 className="font-display text-5xl font-bold tracking-tight">Worth the walk this week</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-soft">
          {all.length} events on campus in the next 7 days, from ASU Events and Sun Devil Central.
        </p>

        {plan.suggestions.length > 0 && (
          <section className="mt-8">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-3xl font-bold">{MASCOT}’s picks for {formatDay(plan.date).split(",")[0]}</h2>
              <p className="text-sm text-ink-soft">Ranked by Gemini for your interests and free time</p>
            </div>
            <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plan.suggestions.map((s) => (
                <li key={s.id} className="flex flex-col rounded-3xl bg-sun-soft p-5">
                  {s.why && <Reason text={s.why} />}
                  <h3 className="mt-3 text-xl font-bold leading-snug">{s.title}</h3>
                  <p className="text-ink-soft">
                    {s.end ? rangeLabel(parseLocal(s.start).hours, parseLocal(s.end).hours) : clock(s.start)}
                    {s.location ? `, ${placeLabel(s.location)}` : ""}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 pt-1">
                    {addButton(s.id)}
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10"
                      >
                        RSVP
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="mt-10 font-display text-3xl font-bold">Everything this week</h2>
        {interests.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by interest">
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
                  ? "Nothing matches what you picked this week. Try All."
                  : `Nothing tagged ${filter} this week. Try All.`}
            </p>
          )}
          {[...byDay.entries()].map(([date, list]) => (
            <section key={date} className="mb-8">
              <h3 className="font-display text-2xl font-bold">{formatDay(date)}</h3>
              <ul>
                {list.map((e) => {
                  const itemId = `ev-${e.id}`;
                  const today = date === plan.date;
                  const fit = today ? fitOnDay(e, plan.items) : null;
                  const reason = why.get(itemId);
                  return (
                    <li key={e.id} className="grid gap-3 border-t border-ink/10 py-5 sm:grid-cols-[96px_1fr] sm:items-start">
                      <p className="font-display text-xl font-bold">{clock(e.startsAt!)}</p>
                      <div className={fit && !fit.fits ? "opacity-70" : ""}>
                        {reason && <Reason text={reason} />}
                        <h4 className={`text-xl font-bold leading-snug ${reason ? "mt-2" : ""}`}>{e.title}</h4>
                        <p className="text-ink-soft">
                          {whereText(e)}
                          {SOURCE[e.source] ? `, from ${SOURCE[e.source]}` : ""}
                        </p>
                        {fit && (
                          <p
                            className={`mt-2 inline-block rounded-full px-3 py-0.5 text-sm font-bold ${
                              fit.fits ? "bg-saguaro/15 text-saguaro" : "bg-[#8C1D40]/10 text-[#8C1D40]"
                            }`}
                          >
                            {fit.fits ? "Fits your day" : `Clashes with ${fit.clash.title}`}
                          </p>
                        )}
                        {e.description && (
                          <p className="mt-2 line-clamp-2 max-w-prose leading-relaxed text-ink-soft">
                            {cleanDescription(e.description)}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {today && addButton(itemId)}
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
      </div>

      {/* On wide screens Sol keeps you company beside the list. */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 flex flex-col items-center text-center">
          <p className="relative rounded-3xl bg-cloud px-5 py-4 font-bold leading-snug shadow-[0_24px_60px_-28px_rgba(20,50,74,0.55)]">
            {filter === FOR_YOU ? `${events.length} match what you picked this week.` : summary}
            <span aria-hidden className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-cloud" />
          </p>
          <Mascot size={140} animated className="mt-5" />
        </div>
      </aside>
    </div>
  );
}
