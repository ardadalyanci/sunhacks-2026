"use client";

import Link from "next/link";
import { useState } from "react";
import CalendarButton from "@/components/CalendarButton";
import DayPicker from "@/components/DayPicker";
import Mascot from "@/components/Mascot";
import SkyDay from "@/components/SkyDay";
import VoiceBar from "@/components/VoiceBar";
import { MASCOT, PRODUCT } from "@/components/brand";
import { nextWalk, placeLabel, toCelsius, untilText, walkLink } from "@/components/next-walk";
import { formatDay, formatTime, parseLocal } from "@/components/time";
import { useChosenDay } from "@/components/useChosenDay";
import { useDay } from "@/components/useDay";
import { useNow } from "@/components/useNow";
import type { DayItem } from "@/lib/types";

const KIND: Record<DayItem["type"], string> = {
  class: "Class",
  deadline: "Assignment",
  event: "Event",
  study_block: "Study block",
  travel: "Walk",
};

const clock = (iso: string) => formatTime(parseLocal(iso).hours);
const isCourse = (title: string) => /^[A-Z]{2,4} \d{3}/.test(title); // "CSE 230", not "Shift at the MU"
const weekdayOf = (date: string) => formatDay(date).split(",")[0];

export default function TodayPage() {
  const chosen = useChosenDay();
  const day = useDay(chosen.date || undefined);
  const clockNow = useNow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
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

  // The headline is the next walk. The sample day and later days keep their own clock (request.now: 8 am for the
  // sample, the real time for a look-ahead); a real today uses the live clock, so the countdown moves.
  const nowMs = day.isDemo || later ? Date.parse(request?.now ?? plan.date) : clockNow;
  const walk = nowMs ? nextWalk(plan.items, nowMs) : null;
  const hasWalks = plan.items.some((i) => i.leaveAt);
  const name = firstName ? `, ${firstName}` : "";
  const headline = walk
    ? later
      ? `${plan.date === chosen.days[1] ? "Tomorrow" : weekdayOf(plan.date)}, leave at ${clock(walk.item.leaveAt!)}.`
      : walk.now
        ? `Leave now${name}.`
        : `Leave at ${clock(walk.item.leaveAt!)}${name}.`
    : hasWalks
      ? `You're done walking for today${name}.`
      : later
        ? `No classes on ${weekdayOf(plan.date)}.`
        : `No classes today${name}.`;
  const weatherLine = plan.weather
    ? later
      ? ` · high ${Math.round(plan.weather.highF)}°F`
      : ` · ${Math.round(plan.weather.tempF)}°F, high ${Math.round(plan.weather.highF)}°F`
    : "";

  return (
    <>
      {day.isDemo && (
        <p className="mb-6 rounded-2xl bg-cloud/70 px-4 py-3">
          This is a sample day for {firstName || "a student"}, a CS sophomore.{" "}
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
          : `${later ? "Preview of " : ""}${formatDay(plan.date)}${weatherLine}`}
      </p>
      <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{headline}</h1>
      {walk && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-lg">
            {walk.item.title} {isCourse(walk.item.title) ? "in" : "at"}{" "}
            <span className="font-bold">{placeLabel(walk.item.location)}</span> ·{" "}
            {walk.minutes}-minute walk
            {!later && !walk.now ? ` · in ${untilText(walk.leaveMs - nowMs)}` : ""}
          </p>
          <a
            href={walkLink(walk.item.location)}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border-2 border-ink px-4 py-1.5 font-bold hover:bg-ink/10"
          >
            Walk me there
          </a>
        </div>
      )}
      <DayPicker days={chosen.days} date={chosen.date} />
      {!later && (
        <button
          type="button"
          aria-pressed={day.hot}
          disabled={day.busy}
          onClick={() => void day.setHotPreview(!day.hot)}
          className={`mt-3 rounded-full border-2 px-4 py-2 font-bold disabled:opacity-50 ${
            day.hot ? "border-[#F97316] bg-[#F97316] text-ink" : "border-ink/20 bg-cloud hover:border-ink"
          }`}
        >
          What if it’s 104°?
        </button>
      )}

      {/* The heat warning comes first, right under the switch that previews it. */}
      {heat && (
        <section
          role="alert"
          className="mt-4 flex items-center gap-4 rounded-3xl bg-gradient-to-r from-[#FFC627] to-[#F97316] p-5 text-ink sm:p-6"
        >
          <Mascot size={64} mood="hot" className="shrink-0" label="" />
          <div>
            <p className="font-display text-2xl font-bold">
              {later
                ? `Up to ${Math.round(heat.highF)}°F (${toCelsius(heat.highF)}°C) on ${weekdayOf(plan.date)}. Sorry, that’s me.`
                : `${Math.round(heat.tempF)}°F (${toCelsius(heat.tempF)}°C) now, up to ${Math.round(heat.highF)}°F. Sorry, that’s me.`}
            </p>
            <p className="mt-1 max-w-prose text-lg">
              Every leave time below is a few minutes earlier, so you’re not sprinting to class. Fill your bottle before
              you go, and cut through air-conditioned buildings when you can.
            </p>
          </div>
        </section>
      )}

      <section aria-busy={day.switching} className={`mt-4 flex flex-col gap-4 sm:flex-row sm:items-start ${dim}`}>
        <div
          className={`shrink-0 self-center sm:mt-2 sm:self-start ${
            listening ? "mascot-listening" : speaking ? "mascot-talking" : ""
          }`}
        >
          <Mascot size={112} mood={mood} animated />
        </div>
        {/* Sol's briefing is his speech bubble; the tail points at him. */}
        <div className="relative min-w-0 flex-1 rounded-3xl bg-cloud p-5 sm:p-6">
          <span
            aria-hidden
            className="absolute -top-2 left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 bg-cloud sm:top-10 sm:-left-2 sm:translate-x-0"
          />
          <p className="relative max-w-prose text-lg leading-relaxed">{plan.briefing}</p>
          {!plan.aiUsed && (
            <p className="mt-2 text-sm text-ink-soft">
              Gemini is not connected, so {MASCOT} planned this with plain rules.
            </p>
          )}
          <div className="relative mt-4">
            {/* A new day starts with a clean voice bar, not the last day's answer. */}
            <VoiceBar
              key={plan.date}
              briefing={plan.briefing}
              onCommand={day.command}
              onListeningChange={setListening}
              onSpeakingChange={setSpeaking}
            />
          </div>
        </div>
      </section>

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
          <div className="mt-4">
            <CalendarButton plan={plan} name={firstName} />
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-live="polite">
          {selected ? (
            <section className="rounded-3xl bg-cloud p-5">
              <p className="font-bold text-ink-soft">
                {selectedIsSuggestion
                  ? "Suggested event"
                  : selected.type === "class" && !isCourse(selected.title)
                    ? "On your schedule"
                    : KIND[selected.type]}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{selected.title}</h2>
              <p className="mt-2">
                {selected.type === "deadline"
                  ? `Due ${clock(selected.start)}`
                  : `${clock(selected.start)}${selected.end ? ` to ${clock(selected.end)}` : ""}`}
                {selected.location ? `, ${selected.location}` : ""}
              </p>
              {selected.leaveAt && (
                <p className="mt-2 font-bold">
                  Leave at {clock(selected.leaveAt)} for {placeLabel(selected.location) || selected.title}.
                </p>
              )}
              {selected.why && <p className="mt-2">{selected.why}</p>}
              {selected.type === "study_block" &&
                (() => {
                  // Explain the block: which assignment it is for and when that is due.
                  const due = deadlines.find((d) => selected.title.endsWith(d.title));
                  return due ? (
                    <p className="mt-2">
                      {MASCOT} saved this free time for {due.title}, due {dueDay(parseLocal(due.start).date)} at{" "}
                      {clock(due.start)}.
                    </p>
                  ) : null;
                })()}
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
                        <p className={`text-sm font-bold ${d.done ? "text-saguaro" : "text-[#8C1D40]"}`}>
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
