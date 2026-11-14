"use client";

import { useMemo, useState } from "react";
import type { Layer, Opportunity, Recommendation } from "@/lib/types";
import { formatDay, formatTime, parseLocal } from "@/components/time";
import { demoOpportunities, demoPlan, demoRecommendations, demoStudent } from "@/mocks/demo";

type Filter = "all" | Layer;
type Row = { rec: Recommendation; opp: Opportunity };

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "career", label: "Career" },
  { value: "social", label: "Social" },
];

const TAG: Record<Layer, string> = {
  career: "bg-saguaro/10 text-saguaro",
  social: "bg-dusk/10 text-dusk",
};

function dueDate(iso: string) {
  return new Date(`${parseLocal(iso).date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function DiscoverPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [added, setAdded] = useState<Set<string>>(() => new Set(demoPlan.map((p) => p.opportunityId)));

  const rows = useMemo<Row[]>(
    () =>
      demoRecommendations
        .filter((rec) => filter === "all" || rec.layer === filter)
        .flatMap((rec) => {
          const opp = demoOpportunities.find((o) => o.id === rec.opportunityId);
          return opp ? [{ rec, opp }] : [];
        }),
    [filter],
  );

  const byDay = useMemo(() => {
    const groups = new Map<string, Row[]>();
    rows
      .filter((r) => r.opp.startsAt)
      .sort((a, b) => a.opp.startsAt!.localeCompare(b.opp.startsAt!))
      .forEach((r) => {
        const date = parseLocal(r.opp.startsAt!).date;
        groups.set(date, [...(groups.get(date) ?? []), r]);
      });
    return [...groups.entries()];
  }, [rows]);

  const deadlines = rows
    .filter((r) => !r.opp.startsAt && r.opp.deadline)
    .sort((a, b) => a.opp.deadline!.localeCompare(b.opp.deadline!));

  function toggle(id: string) {
    setAdded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Picked for you</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-soft">
        Ranked by how much each one moves you toward your goal: {demoStudent.careerGoals[0].toLowerCase()}.
      </p>

      <div className="mt-6 inline-flex rounded-full border-2 border-ink p-1" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 font-bold ${
              filter === f.value ? "bg-ink text-cloud" : "hover:bg-ink/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_300px]">
        <div>
          {byDay.length === 0 && (
            <p className="text-lg">Nothing in this group this week. Try Everything to see all picks.</p>
          )}
          {byDay.map(([date, dayRows]) => (
            <section key={date} className="mb-8">
              <h2 className="font-display text-2xl font-bold">{formatDay(date)}</h2>
              <ul>
                {dayRows.map(({ rec, opp }) => {
                  const isAdded = added.has(opp.id);
                  return (
                    <li
                      key={opp.id}
                      className="grid gap-3 border-t border-ink/10 py-5 sm:grid-cols-[96px_1fr_auto] sm:items-start"
                    >
                      <p className="font-display text-xl font-bold">
                        {formatTime(parseLocal(opp.startsAt!).hours)}
                      </p>
                      <div>
                        <h3 className="text-xl font-bold leading-snug">{opp.title}</h3>
                        <p className="text-ink-soft">
                          {opp.organizer}
                          {opp.location ? `, ${opp.location}` : ""}
                        </p>
                        <p className="mt-2 max-w-prose leading-relaxed">
                          <span className={`mr-2 rounded-full px-2 py-0.5 text-sm font-bold ${TAG[rec.layer]}`}>
                            {rec.layer === "career" ? "Career" : "Social"}
                          </span>
                          {rec.why}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-pressed={isAdded}
                        onClick={() => toggle(opp.id)}
                        className={`justify-self-start rounded-full px-4 py-2 font-bold ${
                          isAdded ? "border-2 border-ink hover:bg-ink/10" : "bg-ink text-cloud hover:bg-ink/90"
                        }`}
                      >
                        {isAdded ? "Added to your week" : "Add to my week"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <aside className="self-start rounded-3xl bg-sun-soft p-5">
          <h2 className="font-display text-2xl font-bold">Apply before the deadline</h2>
          {deadlines.length === 0 && <p className="mt-2">No deadlines in this group.</p>}
          <ul className="mt-2">
            {deadlines.map(({ rec, opp }) => (
              <li key={opp.id} className="border-t border-ink/15 py-4 first:border-t-0">
                <p className="font-bold">Due {dueDate(opp.deadline!)}</p>
                <h3 className="text-lg font-bold leading-snug">{opp.title}</h3>
                <p className="text-ink-soft">{opp.organizer}</p>
                <p className="mt-2 leading-relaxed">{rec.why}</p>
                <a
                  href={opp.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block rounded-full bg-ink px-4 py-2 font-bold text-cloud hover:bg-ink/90"
                >
                  Open application
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
