"use client";

import Link from "next/link";
import { useState } from "react";
import Mascot from "@/components/Mascot";
import SkyDay from "@/components/SkyDay";
import VoiceBar from "@/components/VoiceBar";
import { PRODUCT } from "@/components/brand";
import { formatDay, formatTime, parseLocal } from "@/components/time";
import { useDay } from "@/components/useDay";
import type { DayItem } from "@/lib/types";

const KIND: Record<DayItem["kind"], string> = {
  class: "Class",
  study: "Study block",
  event: "Event",
  leave: "Time to leave",
  assignment: "Assignment",
};

const clock = (iso: string) => formatTime(parseLocal(iso).hours);

export default function TodayPage() {
  const day = useDay();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const { data, plan } = day;

  if (!data || !plan) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Mascot size={128} animated mood={day.error ? "hot" : "happy"} />
        <p className="mt-4 max-w-md text-xl font-bold">{day.error || `${PRODUCT} is planning your day…`}</p>
        {day.error && (
          <Link href="/setup" className="mt-4 rounded-full bg-ink px-5 py-3 font-bold text-cloud">
            Check your setup
          </Link>
        )}
      </div>
    );
  }

  const heat = plan.heatAlert;
  const assignments = [...plan.items.filter((i) => i.kind === "assignment"), ...data.dueSoon];
  const allDone = assignments.length > 0 && assignments.every((a) => a.submitted);
  const mood = listening ? "listening" : heat ? "hot" : allDone ? "proud" : "happy";
  const selected = plan.items.find((i) => i.id === selectedId) ?? null;
  const firstName = data.setup.name.split(" ")[0];
  const tonight = data.picks.filter(
    (p) =>
      p.event.startsAt.startsWith(plan.date) &&
      !plan.items.some((i) => i.kind === "event" && i.title === p.event.title),
  );

  return (
    <>
      {data.demo && (
        <p className="mb-6 rounded-2xl bg-cloud/70 px-4 py-3">
          You are looking at a sample student’s day.{" "}
          <Link href="/setup" className="font-bold underline underline-offset-4">
            Set up yours
          </Link>{" "}
          in two minutes.
        </p>
      )}

      <p className="text-lg text-ink-soft">{formatDay(plan.date)}</p>
      <h1 className="font-display text-5xl font-bold tracking-tight">
        {firstName && firstName !== "there" ? `Your day, ${firstName}` : "Your day"}
      </h1>

      <section className="mt-6 flex flex-col gap-5 rounded-3xl bg-cloud p-5 sm:flex-row sm:items-start sm:p-6">
        <div className={`shrink-0 self-center sm:self-start ${listening ? "mascot-listening" : ""}`}>
          <Mascot size={128} mood={mood} animated />
        </div>
        <div className="min-w-0 flex-1">
          <p className="max-w-prose text-lg leading-relaxed">{plan.briefing}</p>
          <div className="mt-4">
            <VoiceBar briefing={plan.briefing} onCommand={day.command} onListeningChange={setListening} />
          </div>
        </div>
      </section>

      {heat && (
        <section role="alert" className="mt-4 rounded-3xl bg-[#ff8a3d] p-5 sm:p-6">
          <p className="font-display text-2xl font-bold">
            Feels like {Math.round(heat.feelsLikeF)}°F at {clock(heat.at)}
          </p>
          <p className="mt-1 max-w-prose text-lg">{heat.message}</p>
        </section>
      )}

      {day.error && <p className="mt-4 font-bold text-[#b91c1c]">{day.error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <SkyDay items={plan.items} hot={Boolean(heat)} selectedId={selectedId} onSelect={setSelectedId} />
          <label className="mt-3 flex items-center gap-2 text-ink-soft">
            <input
              type="checkbox"
              checked={day.hot}
              disabled={day.busy}
              onChange={(e) => void day.setHotPreview(e.target.checked)}
              className="h-4 w-4 accent-[#ff8a3d]"
            />
            Preview a hot September day
          </label>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-live="polite">
          {selected ? (
            <section className="rounded-3xl bg-cloud p-5">
              <p className="font-bold text-ink-soft">{KIND[selected.kind]}</p>
              <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{selected.title}</h2>
              <p className="mt-2">
                {selected.kind === "assignment" && selected.dueAt && `Due ${clock(selected.dueAt)}`}
                {selected.kind === "leave" && selected.startsAt && `Leave at ${clock(selected.startsAt)}`}
                {selected.startsAt && selected.endsAt && `${clock(selected.startsAt)} to ${clock(selected.endsAt)}`}
                {selected.location ? `, ${selected.location}` : ""}
              </p>
              {selected.kind === "leave" && selected.walkMinutes !== undefined && (
                <p className="mt-2">It is a {selected.walkMinutes} minute walk, so you arrive with a few minutes to spare.</p>
              )}
              {selected.kind === "study" && (
                <p className="mt-2">
                  Saved for {assignments.find((a) => a.id === selected.forItemId)?.title ?? "an assignment"}
                  {selected.estimatedMinutes ? `. It usually takes about ${selected.estimatedMinutes} minutes.` : "."}
                </p>
              )}
              {selected.kind === "assignment" && (
                <p className={`mt-2 font-bold ${selected.submitted ? "text-saguaro" : ""}`}>
                  {selected.submitted ? "Turned in" : "Not turned in yet"}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.url && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-ink px-4 py-2 font-bold text-cloud hover:bg-ink/90"
                  >
                    {selected.kind === "event" ? "Open event page" : "Open in Canvas"}
                  </a>
                )}
                {selected.kind === "event" && (
                  <button
                    type="button"
                    disabled={day.busy}
                    onClick={() => {
                      void day.removeEvent(selected.id);
                      setSelectedId(null);
                    }}
                    className="rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10 disabled:opacity-50"
                  >
                    Remove from my day
                  </button>
                )}
                {selected.kind === "study" && (
                  <button
                    type="button"
                    onClick={() => {
                      day.hide(selected.id);
                      setSelectedId(null);
                    }}
                    className="rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10"
                  >
                    Remove this block
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-full px-4 py-2 font-bold hover:bg-ink/10"
                >
                  Close
                </button>
              </div>
            </section>
          ) : (
            <>
              <section className="rounded-3xl bg-cloud p-5">
                <h2 className="font-display text-2xl font-bold">Due soon</h2>
                {assignments.length === 0 && (
                  <p className="mt-2 text-ink-soft">Nothing due. Add your Canvas token in Setup to see assignments.</p>
                )}
                <ul className="mt-2">
                  {assignments.map((a) => (
                    <li key={a.id} className="border-t border-ink/10 py-3 first:border-t-0">
                      <p className="font-bold leading-snug">{a.title}</p>
                      <p className="text-ink-soft">
                        {a.course ? `${a.course}, due` : "Due"}{" "}
                        {a.dueAt
                          ? `${parseLocal(a.dueAt).date === plan.date ? "today" : formatDay(parseLocal(a.dueAt).date)} at ${clock(a.dueAt)}`
                          : "soon"}
                      </p>
                      <p className={`text-sm font-bold ${a.submitted ? "text-saguaro" : ""}`}>
                        {a.submitted
                          ? "Turned in"
                          : a.estimatedMinutes
                            ? `Not turned in, about ${a.estimatedMinutes} min of work`
                            : "Not turned in yet"}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              {tonight.length > 0 && (
                <section className="rounded-3xl bg-sun-soft p-5">
                  <h2 className="font-display text-2xl font-bold">Fits in your day</h2>
                  <ul className="mt-2">
                    {tonight.map(({ event, why }) => (
                      <li key={event.id} className="border-t border-ink/15 py-3 first:border-t-0">
                        <p className="font-bold leading-snug">{event.title}</p>
                        <p className="text-ink-soft">
                          {clock(event.startsAt)}
                          {event.location ? `, ${event.location}` : ""}
                        </p>
                        <p className="mt-1">{why}</p>
                        <button
                          type="button"
                          disabled={day.busy}
                          onClick={() => void day.addEvent(event.id)}
                          className="mt-2 rounded-full bg-ink px-4 py-2 font-bold text-cloud hover:bg-ink/90 disabled:opacity-50"
                        >
                          Add to my day
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
