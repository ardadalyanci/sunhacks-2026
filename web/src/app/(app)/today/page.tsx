"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import CalendarButton from "@/components/CalendarButton";
import DayList from "@/components/DayList";
import DayPicker from "@/components/DayPicker";
import HowSolPlanned from "@/components/HowSolPlanned";
import Mascot from "@/components/Mascot";
import SkyDay from "@/components/SkyDay";
import VoiceBar from "@/components/VoiceBar";
import WalkMap from "@/components/WalkMap";
import WhatIfBar from "@/components/WhatIfBar";
import { MASCOT, PRODUCT } from "@/components/brand";
import {
  SHUTTLE_TRACKER,
  nextWalk,
  placeLabel,
  toCelsius,
  tripLabel,
  untilText,
  walkLink,
} from "@/components/next-walk";
import { loadSetup } from "@/components/setup-store";
import { formatDay, formatTime, parseLocal } from "@/components/time";
import { useChosenDay } from "@/components/useChosenDay";
import { useDay } from "@/components/useDay";
import { useNow } from "@/components/useNow";
import { useView } from "@/components/useView";
import type { DayItem } from "@/lib/types";

const KIND: Record<DayItem["type"], string> = {
  class: "Class",
  deadline: "Assignment",
  event: "Event",
  study_block: "Study block",
  travel: "Walk",
};

const clock = (iso: string) => formatTime(parseLocal(iso).hours);
const isCourse = (title: string) => /^[A-Z]{2,4} \d{3}[A-Z]?$/.test(title); // "CSE 230", not "MAT 343 study group"
const weekdayOf = (date: string) => formatDay(date).split(",")[0];

/*
 * One DOM order for every screen: the phone order (hero, heat, Sol, sky, Due soon, Fits your day, walks, How Sol
 * planned). From lg up the same elements are placed on a two-column grid, so the sky starts right under the hero
 * and Sol talks from the right column. On a hot day the laptop shows the heat card under Sol's bubble instead of
 * across the page (see HeatCard), so the hot sky stays on the first screen. Keyboard and screen-reader order still
 * follow what is seen.
 */
const AT = {
  full: "lg:col-span-2 lg:row-start-1",
  hero: "lg:col-start-1 lg:row-start-2 lg:self-start",
  sol: "lg:col-start-2 lg:row-start-2 lg:self-start",
  sky: "lg:col-start-1 lg:row-start-3",
  side: "lg:col-start-2 lg:row-start-3 lg:row-span-2",
  walks: "lg:col-start-1 lg:row-start-4",
  how: "lg:col-span-2 lg:row-start-5",
};

/**
 * The heat warning. On a phone or tablet (`wide` false) it runs across the page between the hero and Sol, with its
 * own small sweating Sol; from lg up (`wide` true) it is a card under Sol's bubble, where the big Sol right above
 * already sweats. Only one of the two is shown at a time, so each has its own heading id.
 */
function HeatCard({ title, wide }: { title: string; wide: boolean }) {
  const id = wide ? "heat-title-side" : "heat-title";
  return (
    <section
      aria-labelledby={id}
      className={`rounded-2xl bg-gradient-to-r from-[#FFC627] to-[#F97316] text-ink ${
        wide ? "mt-4 hidden p-5 lg:block" : "mt-4 flex items-center gap-4 p-5 sm:p-6 lg:hidden"
      }`}
    >
      {!wide && <Mascot size={64} mood="hot" className="shrink-0" label="" />}
      <div>
        <p id={id} className={`font-display font-bold ${wide ? "text-xl leading-snug" : "text-2xl"}`}>
          {title}
        </p>
        <p className={`mt-1 max-w-prose ${wide ? "" : "text-lg"}`}>
          Every leave time {wide ? "on your day" : "below"} is a few minutes earlier, so you’re not sprinting to
          class. Fill your bottle before you go, and cut through air-conditioned buildings when you can.
        </p>
      </div>
    </section>
  );
}

export default function TodayPage() {
  const chosen = useChosenDay();
  const day = useDay(chosen.date || undefined);
  const clockNow = useNow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [view, setView] = useView();
  const sheet = useRef<HTMLElement>(null);
  const cardTitle = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null); // what opened the selected item's card, to give focus back to
  const [sheetHeight, setSheetHeight] = useState(0);
  const { plan, request } = day;
  const grid = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const sol = useRef<HTMLDivElement>(null);
  const side = useRef<HTMLElement>(null);
  const hasPlan = Boolean(plan);

  // On a laptop Sol's bubble is usually taller than the hero beside it. How much taller goes into --sol-over, so
  // the sky can start right under the hero while Due soon waits under Sol. Written straight to the style, so it
  // lands before the next paint. The side column's height goes into --side-h for its sticky offset (see the aside).
  useEffect(() => {
    const box = grid.current;
    const left = hero.current;
    const right = sol.current;
    const column = side.current;
    if (!box || !left || !right || !column || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      box.style.setProperty("--sol-over", `${Math.max(0, right.offsetHeight - left.offsetHeight)}px`);
      box.style.setProperty("--side-h", `${column.offsetHeight}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(left);
    observer.observe(right);
    observer.observe(column);
    return () => observer.disconnect();
  }, [hasPlan]);

  // Escape closes the selected item's card (the bottom sheet on a phone).
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  // Focus follows the card: it moves to the card's heading when an item is picked (so Tab reaches its buttons next),
  // and goes back to whatever opened it when the card closes (Close, Escape, Remove). Picking another item while
  // the card is open keeps the first opener.
  useEffect(() => {
    if (!selectedId) {
      const back = opener.current;
      opener.current = null;
      if (back?.isConnected) back.focus({ preventScroll: true });
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !sheet.current?.contains(active)) {
      opener.current = active;
    }
    cardTitle.current?.focus({ preventScroll: true });
  }, [selectedId]);

  // On a phone the card is a sheet over the page bottom; a spacer as tall as the sheet keeps the last rows reachable.
  useEffect(() => {
    const el = sheet.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setSheetHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectedId]);

  if (!plan) {
    // Before the first plan: Sol plans, or the first load failed. A saved setup is the only thing worth checking.
    const hasSetup = day.error ? loadSetup() !== null : false;
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Mascot size={128} animated mood={day.error ? "hot" : "happy"} />
        <p className="mt-4 max-w-md text-xl font-bold">{day.error || `${PRODUCT} is planning your day…`}</p>
        {day.error && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-ink px-5 py-3 font-semibold text-cloud hover:bg-ink/90"
            >
              Try again
            </button>
            {hasSetup && (
              <Link href="/setup" className="rounded-lg border border-line bg-surface px-5 py-3 font-semibold hover:border-ink/40">
                Check your setup
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  const later = chosen.today !== "" && plan.date > chosen.today; // a look-ahead at a coming day
  const tomorrow = chosen.days[1];
  const dueDay = (date: string) =>
    date === chosen.today ? "today" : date === tomorrow ? "tomorrow" : formatDay(date);
  const heat = plan.weather?.isHot ? plan.weather : undefined;
  // Sol (with the heat card under his bubble on a hot day) may hang below the hero into the sky's row; Due soon
  // then starts under him.
  const overhang = { sol: "lg:mb-[calc(var(--sol-over,0px)*-1)]", side: "lg:mt-[calc(var(--sol-over,0px)+1.5rem)]" };
  const heatTitle = heat
    ? later
      ? `Up to ${Math.round(heat.highF)}°F (${toCelsius(heat.highF)}°C) on ${weekdayOf(plan.date)}. Sorry, that’s me.`
      : `${Math.round(heat.tempF)}°F (${toCelsius(heat.tempF)}°C) now, up to ${Math.round(heat.highF)}°F. Sorry, that’s me.`
    : "";
  const dim = day.switching ? "opacity-60 transition-opacity" : "transition-opacity"; // the old day while a new one loads
  const deadlines = [...(request?.deadlines ?? [])].sort((a, b) => a.start.localeCompare(b.start));
  const allDone = deadlines.length > 0 && deadlines.every((d) => d.done);
  const mood = listening ? "listening" : heat ? "hot" : allDone ? "proud" : "happy";
  const firstName = day.name.split(" ")[0];
  const selected =
    plan.items.find((i) => i.id === selectedId) ?? plan.suggestions.find((s) => s.id === selectedId) ?? null;
  const selectedIsSuggestion = selected !== null && plan.suggestions.some((s) => s.id === selected.id);
  // With a card open, the desktop column shows only the card; a phone keeps both lists under the sheet.
  const underCard = selected ? "lg:hidden" : "";

  // The headline is the next walk. The sample day and later days keep their own clock (request.now: 8 am for the
  // sample, the real time for a look-ahead, the late wake-up while "What if I oversleep?" is on); a real today
  // otherwise uses the live clock, so the countdown moves.
  const nowMs = day.isDemo || later || day.whatIf.overslept ? Date.parse(request?.now ?? plan.date) : clockNow;
  const walk = nowMs ? nextWalk(plan.items, nowMs) : null;
  const tight = walk?.item.why?.startsWith("Tight:") ? walk.item.why : null; // the walk starts before the last stop ends
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
  // Where Sol rests on the sky: the sample's own clock (8 am), the live clock on a real today, none ahead.
  const azNow = new Date(clockNow - 7 * 3_600_000);
  const nowHour = later
    ? undefined
    : day.isDemo
      ? request?.now
        ? parseLocal(request.now).hours
        : undefined
      : clockNow
        ? azNow.getUTCHours() + azNow.getUTCMinutes() / 60
        : undefined;
  const weatherLine = plan.weather
    ? later
      ? ` · high ${Math.round(plan.weather.highF)}°F`
      : ` · ${Math.round(plan.weather.tempF)}°F, high ${Math.round(plan.weather.highF)}°F`
    : "";

  return (
    <div ref={grid} className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-10">
      {day.isDemo && (
        <p className={`mb-6 rounded-xl border border-line bg-surface px-4 py-3 text-[15px] ${AT.full}`}>
          This is a sample day for {firstName || "a student"}, a CS sophomore.{" "}
          <Link href="/setup" className="font-semibold underline underline-offset-4">
            Set up yours
          </Link>{" "}
          in two minutes.
        </p>
      )}
      {!day.isDemo && day.notice && (
        <p className={`mb-6 rounded-xl border border-sun/40 bg-sun-soft/60 px-4 py-3 text-[15px] ${AT.full}`}>{day.notice}</p>
      )}

      <div ref={hero} className={`min-w-0 ${AT.hero}`}>
        {/* Only the switch to another day is spoken; a pill press is told once, by Sol's note under the pills. */}
        <span aria-live="polite" className="sr-only">
          {day.switching ? `Planning ${formatDay(chosen.date)}…` : ""}
        </span>
        <p className="text-[15px] font-medium text-ink-soft">
          {day.switching
            ? `Planning ${formatDay(chosen.date)}…`
            : `${later ? "Preview of " : ""}${formatDay(plan.date)}${weatherLine}`}
        </p>
        <h1 className="mt-1 font-display text-[2rem] font-bold leading-tight tracking-tight sm:text-[2.75rem]">{headline}</h1>
        {walk && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[17px]">
              {walk.item.title} {isCourse(walk.item.title) ? "in" : "at"}{" "}
              <span className="font-semibold">{placeLabel(walk.item.location)}</span> ·{" "}
              {tripLabel(walk.item, walk.minutes)}
              {!later && !walk.now ? ` · in ${untilText(walk.leaveMs - nowMs)}` : ""}
            </p>
            {/* A campus walk gets walking directions; a shuttle ride gets ASU's live shuttle map. */}
            {!walk.item.via ? (
              <a
                href={walkLink(walk.item.location, walk.item.campus)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center rounded-lg border border-line bg-surface px-3.5 text-[15px] font-semibold hover:border-ink/40"
              >
                Walk me there
              </a>
            ) : walk.item.via.includes("shuttle") ? (
              <a
                href={SHUTTLE_TRACKER}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center rounded-lg border border-line bg-surface px-3.5 text-[15px] font-semibold hover:border-ink/40"
              >
                Where’s my shuttle?
              </a>
            ) : null}
          </div>
        )}
        {tight && <p className="mt-2 max-w-prose font-semibold text-[#8C1D40]">{tight}</p>}
        <DayPicker days={chosen.days} date={chosen.date} />
        {/* "What if…" pills (heat, oversleeping, a cancelled class) and Sol's one-line note on what changed. */}
        {!later && <WhatIfBar day={day} />}
        {day.error && <p className="mt-4 font-bold text-[#b91c1c]">{day.error}</p>}
      </div>

      {/* The heat warning on a phone or tablet: across the page, right under the pill that previews it. Plain
          content: Sol's note says it. From lg up it sits under Sol's bubble instead (below). */}
      {heat && <HeatCard title={heatTitle} wide={false} />}

      {/* Sol and his speech bubble: beside the hero on a laptop (with the heat card under it), under it on a phone. */}
      <div ref={sol} className={`min-w-0 ${overhang.sol} ${AT.sol}`}>
        <section
          aria-busy={day.switching}
          aria-label={`${MASCOT}’s briefing`}
          className={`mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:mt-0 lg:p-5 ${dim}`}
        >
          <div className="flex items-center gap-3">
            <div className={`shrink-0 ${listening ? "mascot-listening" : speaking ? "mascot-talking" : ""}`}>
              <Mascot size={52} mood={mood} animated />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">{MASCOT}’s take on your day</h2>
              <p className="text-sm text-ink-soft">From your classes, Canvas and the weather</p>
            </div>
          </div>
          <p className="mt-4 max-w-prose text-base leading-relaxed">{plan.briefing}</p>
          {!plan.aiUsed && (
            <p className="mt-2 text-sm text-ink-soft">Gemini is not connected, so {MASCOT} planned this with plain rules.</p>
          )}
          <div className="mt-4">
            {/* A new day starts with a clean voice bar, not the last day's answer. */}
            <VoiceBar
              key={plan.date}
              briefing={plan.briefing}
              onCommand={day.command}
              onListeningChange={setListening}
              onSpeakingChange={setSpeaking}
            />
          </div>
        </section>
        {heat && <HeatCard title={heatTitle} wide />}
      </div>

      <div aria-busy={day.switching} className={`mt-6 min-w-0 ${AT.sky} ${dim}`}>
        {/* The same day two ways: the sky, or a plain large list (easier with zoom or a screen reader). */}
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView(view === "list" ? "sky" : "list")}
            className="min-h-10 rounded-lg px-3 py-2 font-semibold underline underline-offset-4 hover:bg-ink/10"
          >
            {view === "list" ? "Show the sky" : "Show as a list"}
          </button>
        </div>
        {view === "list" ? (
          <DayList date={plan.date} items={plan.items} nowMs={nowMs} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <SkyDay
            date={plan.date}
            items={plan.items}
            hot={Boolean(heat)}
            nowHour={nowHour}
            suggestion={plan.suggestions[0]}
            onAdd={(id) => void day.accept(id)}
            busy={day.busy}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}
        <div className="mt-4">
          <CalendarButton plan={plan} name={firstName} />
        </div>
      </div>

      {/* Stays in view while the sky scrolls on a laptop. When it is taller than the screen, its top goes negative so
          it scrolls until its last card is in view and sticks there: nothing is ever cut off. */}
      <aside
        ref={side}
        aria-busy={day.switching}
        className={`mt-6 ${overhang.side} lg:sticky lg:top-[min(6rem,calc(100dvh_-_var(--side-h,0px)_-_1rem))] lg:self-start ${AT.side} ${dim}`}
      >
        {/* Only the picked item's card is announced; the lists below stay quiet when a pill changes them. */}
        <div aria-live="polite">
          {selected && (
            <section
              ref={sheet}
              aria-labelledby="selected-title"
              className="fixed inset-x-0 bottom-0 z-40 max-h-[60vh] overflow-y-auto overscroll-contain rounded-t-2xl bg-surface px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(20,50,74,0.28)] motion-safe:transition-[translate,opacity] motion-safe:duration-200 max-lg:starting:translate-y-8 max-lg:starting:opacity-0 lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:rounded-2xl lg:border lg:border-line lg:p-5 lg:shadow-none"
            >
              <span aria-hidden className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-ink/20 lg:hidden" />
              <p className="font-bold text-ink-soft">
                {selectedIsSuggestion
                  ? "Suggested event"
                  : selected.type === "class" && !isCourse(selected.title)
                    ? "On your schedule"
                    : KIND[selected.type]}
              </p>
              <h2
                id="selected-title"
                ref={cardTitle}
                tabIndex={-1}
                className="mt-1 font-display text-xl font-bold leading-tight outline-none"
              >
                {selected.title}
              </h2>
              <p className="mt-2">
                {selected.type === "deadline"
                  ? `Due ${clock(selected.start)}`
                  : `${clock(selected.start)}${selected.end ? ` to ${clock(selected.end)}` : ""}`}
                {selected.location ? `, ${placeLabel(selected.location)}` : ""}
              </p>
              {selected.leaveAt && (
                <p className="mt-2 font-bold">
                  Leave at {clock(selected.leaveAt)} for {placeLabel(selected.location) || selected.title}.
                </p>
              )}
              {selected.via && <p className="mt-2">{selected.via}</p>}
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
                    className="rounded-lg bg-ink px-4 py-2 font-semibold text-cloud hover:bg-ink/90 disabled:opacity-50"
                  >
                    Add to my day
                  </button>
                )}
                {selected.url && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-line bg-surface px-4 py-2 font-semibold hover:border-ink/40"
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
                    className="rounded-lg border border-line bg-surface px-4 py-2 font-semibold hover:border-ink/40 disabled:opacity-50"
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
                    className="rounded-lg border border-line bg-surface px-4 py-2 font-semibold hover:border-ink/40"
                  >
                    Remove this block
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg px-4 py-2 font-semibold hover:bg-ink/10"
                >
                  Close
                </button>
              </div>
            </section>
          )}
        </div>

        <section className={`rounded-2xl border border-line bg-surface p-5 ${underCard}`}>
          <h2 className="font-display text-xl font-bold">Due soon</h2>
          {deadlines.length === 0 && (
            <p className="mt-2 text-ink-soft">Nothing due. Add your Canvas token in Setup to see assignments.</p>
          )}
          <ul className="mt-2">
            {deadlines.map((d) => {
              const date = parseLocal(d.start).date;
              return (
                <li key={d.id} className="border-t border-ink/10 py-3 first:border-t-0">
                  <p className="font-semibold leading-snug">{d.title}</p>
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
          <section className={`mt-4 rounded-2xl border border-line bg-surface p-5 ${underCard}`}>
            <h2 className="font-display text-xl font-bold">Fits your day</h2>
            <ul className="mt-2">
              {plan.suggestions.map((s) => (
                <li key={s.id} className="border-t border-ink/15 py-3 first:border-t-0">
                  <p className="font-semibold leading-snug">{s.title}</p>
                  <p className="text-ink-soft">
                    {clock(s.start)}
                    {s.location ? `, ${placeLabel(s.location)}` : ""}
                  </p>
                  {s.why && <p className="mt-1">{s.why}</p>}
                  <button
                    type="button"
                    disabled={day.busy}
                    onClick={() => void day.accept(s.id)}
                    className="mt-2 rounded-lg bg-ink px-4 py-2 font-semibold text-cloud hover:bg-ink/90 disabled:opacity-50"
                  >
                    Add to my day
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>

      {/* The day's walks on a map, with the minutes for each leg: a wide card under the sky on a laptop. */}
      <div aria-busy={day.switching} className={`mt-6 min-w-0 empty:hidden ${AT.walks} ${dim}`}>
        <WalkMap
          date={plan.date}
          items={plan.items}
          startBuildingId={request?.startBuildingId}
          hot={Boolean(heat)}
          nextItemId={walk?.item.id ?? null}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* How this exact day was put together, with the real numbers. */}
      <div className={`min-w-0 ${AT.how}`}>
        <HowSolPlanned plan={plan} request={request} isDemo={day.isDemo} later={later} />
      </div>

      {/* Room under the phone sheet, so the page's last rows can scroll above it. */}
      {selected && <div aria-hidden className="lg:hidden" style={{ height: sheetHeight }} />}
    </div>
  );
}
