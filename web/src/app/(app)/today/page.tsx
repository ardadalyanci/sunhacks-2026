"use client";

import Link from "next/link";
import { useState } from "react";
import DayPicker from "@/components/DayPicker";
import Mascot from "@/components/Mascot";
import SkyDay from "@/components/SkyDay";
import VoiceBar from "@/components/VoiceBar";
import { PRODUCT } from "@/components/brand";
import { formatDay, formatTime, parseLocal } from "@/components/time";
import { useChosenDay } from "@/components/useChosenDay";
import { useDay } from "@/components/useDay";
import type { DayItem } from "@/lib/types";

const KIND: Record<DayItem["type"], string> = {
  class: "Class",
  deadline: "Assignment",
  event: "Event",
  study_block: "Study block",
  travel: "Walk",
};

const clock = (iso: string) => formatTime(parseLocal(iso).hours);

export default function TodayPage() {
  const chosen = useChosenDay();
  const day = useDay(chosen.date || undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const { plan, request } = day;

  if (!plan) {
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

  const later = chosen.today !== "" && plan.date > chosen.today; // a look-ahead at a coming day
  const tomorrow = chosen.days[1];
  const dueDay = (date: string) =>
    date === chosen.today ? "today" : date === tomorrow ? "tomorrow" : formatDay(date);
  const heat = plan.weather?.isHot ? plan.weather : undefined;
  const dim = day.switching ? "opacity-60 transition-opacity" : "transition-opacity"; // the old day while a new one loads
  const deadlines = [...(request?.deadlines ?? [])].sort((a, b) => a.start.localeCompare(b.start));
  const allDone = deadlines.length > 0 && deadlines.every((d) => d.done);
  const mood = listening ? "listening" : heat ? "hot" : allDone ? "proud" : "happy";
  const firstName = day.name.split(" ")[0];
  const selected =
    plan.items.find((i) => i.id === selectedId) ?? plan.suggestions.find((s) => s.id === selectedId) ?? null;
  const selectedIsSuggestion = selected !== null && plan.suggestions.some((s) => s.id === selected.id);

  return (
    <>
      {day.isDemo && (
        <p className="mb-6 rounded-2xl bg-cloud/70 px-4 py-3">
          You are looking at a sample student’s day.{" "}
          <Link href="/setup" className="font-bold underline underline-offset-4">
            Set up yours
          </Link>{" "}
          in two minutes.
        </p>
      )}
      {!day.isDemo && day.notice && <p className="mb-6 rounded-2xl bg-sun-soft px-4 py-3">{day.notice}</p>}

      <p aria-live="polite" className="text-lg text-ink-soft">
        {day.switching
          ? `Planning ${formatDay(chosen.date)}…`
          : later
            ? `Preview of ${formatDay(plan.date)}`
            : formatDay(plan.date)}
      </p>
      <h1 className="font-display text-5xl font-bold tracking-tight">
        {firstName ? `Your day, ${firstName}` : "Your day"}
      </h1>
      <DayPicker days={chosen.days} date={chosen.date} />

      <section
        aria-busy={day.switching}
        className={`mt-6 flex flex-col gap-5 rounded-3xl bg-cloud p-5 sm:flex-row sm:items-start sm:p-6 ${dim}`}
      >
        <div className={`shrink-0 self-center sm:self-start ${listening ? "mascot-listening" : ""}`}>
          <Mascot size={128} mood={mood} animated />
        </div>
        <div className="min-w-0 flex-1">
          <p className="max-w-prose text-lg leading-relaxed">{plan.briefing}</p>
          {!plan.aiUsed && (
            <p className="mt-2 text-sm text-ink-soft">Gemini is not connected, so this plan was made with plain rules.</p>
          )}
          <div className="mt-4">
            <VoiceBar briefing={plan.briefing} onCommand={day.command} onListeningChange={setListening} />
          </div>
        </div>
      </section>

      {heat && (
        <section role="alert" className="mt-4 rounded-3xl bg-[#ff8a3d] p-5 sm:p-6">
          <p className="font-display text-2xl font-bold">
            {later
              ? `Up to ${Math.round(heat.highF)}°F on ${formatDay(plan.date).split(",")[0]}`
              : `It is ${Math.round(heat.tempF)}°F now and up to ${Math.round(heat.highF)}°F today`}
          </p>
          <p className="mt-1 max-w-prose text-lg">
            Your leave times include extra minutes for the heat. Take water and stay in the shade between classes.
          </p>
        </section>
      )}

      {day.error && <p className="mt-4 font-bold text-[#b91c1c]">{day.error}</p>}

      <div aria-busy={day.switching} className={`mt-6 grid gap-6 lg:grid-cols-[1fr_340px] ${dim}`}>
        <div className="min-w-0">
          <SkyDay
            date={plan.date}
            items={plan.items}
            hot={Boolean(heat)}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {!later && (
            <label className="mt-3 flex items-center gap-2 text-ink-soft">
              <input
                type="checkbox"
                checked={day.hot}
                disabled={day.busy}
                onChange={(e) => void day.setHotPreview(e.target.checked)}
                className="h-4 w-4 accent-[#ff8a3d]"
              />
              Preview a 104°F day
            </label>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-live="polite">
          {selected ? (
            <section className="rounded-3xl bg-cloud p-5">
              <p className="font-bold text-ink-soft">{selectedIsSuggestion ? "Suggested event" : KIND[selected.type]}</p>
              <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{selected.title}</h2>
              <p className="mt-2">
                {selected.type === "deadline"
                  ? `Due ${clock(selected.start)}`
                  : `${clock(selected.start)}${selected.end ? ` to ${clock(selected.end)}` : ""}`}
                {selected.location ? `, ${selected.location}` : ""}
              </p>
              {selected.leaveAt && <p className="mt-2 font-bold">Leave at {clock(selected.leaveAt)}.</p>}
              {selected.why && <p className="mt-2">{selected.why}</p>}
              {selected.type === "deadline" && (
                <p className={`mt-2 font-bold ${selected.done ? "text-saguaro" : ""}`}>
                  {selected.done ? "Turned in" : "Not turned in yet"}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedIsSuggestion && (
                  <button
                    type="button"
                    disabled={day.busy}
                    onClick={() => void day.accept(selected.id)}
                    className="rounded-full bg-ink px-4 py-2 font-bold text-cloud hover:bg-ink/90 disabled:opacity-50"
                  >
                    Add to my day
                  </button>
                )}
                {selected.url && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10"
                  >
                    {selected.type === "deadline" ? "Open in Canvas" : "Open event page"}
                  </a>
                )}
                {!selectedIsSuggestion && selected.type === "event" && (
                  <button
                    type="button"
                    disabled={day.busy}
                    onClick={() => {
                      void day.unaccept(selected.id);
                      setSelectedId(null);
                    }}
                    className="rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10 disabled:opacity-50"
                  >
                    Remove from my day
                  </button>
                )}
                {selected.type === "study_block" && (
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
                {deadlines.length === 0 && (
                  <p className="mt-2 text-ink-soft">Nothing due. Add your Canvas token in Setup to see assignments.</p>
                )}
                <ul className="mt-2">
                  {deadlines.map((d) => {
                    const date = parseLocal(d.start).date;
                    return (
                      <li key={d.id} className="border-t border-ink/10 py-3 first:border-t-0">
                        <p className="font-bold leading-snug">{d.title}</p>
                        <p className="text-ink-soft">
                          Due {dueDay(date)} at {clock(d.start)}
                        </p>
                        <p className={`text-sm font-bold ${d.done ? "text-saguaro" : ""}`}>
                          {d.done ? "Turned in" : "Not turned in yet"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {plan.suggestions.length > 0 && (
                <section className="rounded-3xl bg-sun-soft p-5">
                  <h2 className="font-display text-2xl font-bold">Fits in your day</h2>
                  <ul className="mt-2">
                    {plan.suggestions.map((s) => (
                      <li key={s.id} className="border-t border-ink/15 py-3 first:border-t-0">
                        <p className="font-bold leading-snug">{s.title}</p>
                        <p className="text-ink-soft">
                          {clock(s.start)}
                          {s.location ? `, ${s.location}` : ""}
                        </p>
                        {s.why && <p className="mt-1">{s.why}</p>}
                        <button
                          type="button"
                          disabled={day.busy}
                          onClick={() => void day.accept(s.id)}
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
