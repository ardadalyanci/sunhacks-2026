"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { placeLabel } from "@/lib/places";
import type { DayItem } from "@/lib/types";
import Mascot from "./Mascot";
import { MASCOT } from "./brand";
import {
  PIN_HEIGHT,
  assignmentName,
  blockTitle,
  coversOtherBlock,
  dayBounds,
  dayStops,
  hourOn,
  isDarkHour,
  rangeLabel,
  skyBackground,
  stackPins,
  stopAt,
  sunTimes,
} from "./sky-layout";
import { formatTime, parseLocal } from "./time";

const ROW = 56; // px per hour
const PAD = 14; // px above the first hour and below the last, so their labels are not clipped
const PLAY_SECONDS = 14; // "Play my day" runs the whole day in this long

type Pin = { key: string; itemId: string; at: number; text: string; tone: string; right?: boolean; lane?: boolean; check?: boolean };

type Props = {
  date: string; // the plan's day ("2026-11-14"); items on other days are left out
  items: DayItem[];
  hot?: boolean;
  nowHour?: number; // where Sol rests on the sky when nothing plays (the current time on this day)
  suggestion?: DayItem; // Sol's top event pick, drawn as a dashed "+ Add" block in its free gap
  onAdd?: (id: string) => void;
  busy?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** Scrolls the page just enough to keep `el` (Sol, while the day plays) on screen. */
function keepInView(el: HTMLElement | null) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.top < 90 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ block: "center" });
}

/**
 * One day as a column of sky: time of day is color, and every item sits at its hour. The sky covers 8 am to
 * 10 pm and stretches for anything earlier or later. Leave-time pins sit on the left, deadline pins on the
 * right, and pins that would touch are stacked so none overlap. A leave pin that would cover another block
 * (usually the study block that ends where the walk starts) moves right and drops the walk minutes. A deadline
 * that falls inside a block gets a short label ("Done 5 pm") in a lane at the right edge, and that block
 * narrows so the label never covers its text.
 */
export default function SkyDay({ date, items, hot = false, nowHour, suggestion, onAdd, busy = false, selectedId, onSelect }: Props) {
  const today = items.filter((i) => parseLocal(i.start).date === date);
  const { first, last } = dayBounds(today, date);
  const y = (hour: number) => PAD + (hour - first) * ROW;
  const height = PAD * 2 + (last - first) * ROW;
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const sun = useMemo(() => sunTimes(date), [date]);

  // "Play my day": Sol rides the sky from the first hour to the last, stopping on each walk and deadline.
  const stops = useMemo(
    () => dayStops(items.filter((i) => parseLocal(i.start).date === date), date, sunTimes(date), placeLabel),
    [items, date],
  );
  const [viewHour, setViewHour] = useState<number | null>(null); // where Sol is while playing or dragged
  const [playing, setPlaying] = useState(false);
  const marker = useRef<HTMLDivElement>(null);
  const sky = useRef<HTMLDivElement>(null);
  const resting = nowHour !== undefined && nowHour >= first && nowHour <= last ? nowHour : null;
  const solHour = viewHour ?? resting;
  const stop = viewHour !== null ? stopAt(stops, viewHour) : undefined;
  const caption = viewHour !== null ? stop?.text : resting !== null ? `Now, ${formatTime(resting)}` : undefined;
  const solMood = hot && solHour !== null && solHour >= 11 && solHour <= sun.sunset ? "hot" : (stop?.mood ?? "happy");

  useEffect(() => {
    if (!playing) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let frame = 0;
    let scrolled = 0;
    const tick = (t: number) => {
      const progress = Math.min(1, (t - started) / (PLAY_SECONDS * 1000));
      let hour = first + (last - first) * progress;
      if (reduce) hour = [...stops].reverse().find((s) => s.hour <= hour)?.hour ?? first; // jump stop to stop
      setViewHour(hour);
      if (t - scrolled > 250) {
        scrolled = t;
        keepInView(marker.current);
      }
      if (progress < 1) frame = requestAnimationFrame(tick);
      else {
        setPlaying(false);
        setViewHour(null);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, first, last, stops]);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      setViewHour(null);
    } else {
      setViewHour(first);
      setPlaying(true);
    }
  }

  // Drag Sol (pointer) or move him with the arrow keys to see any time of day.
  const hourAtY = (clientY: number) => {
    const top = sky.current?.getBoundingClientRect().top ?? 0;
    return Math.min(last, Math.max(first, first + (clientY - top - PAD) / ROW));
  };
  function onSolPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setPlaying(false);
    setViewHour(hourAtY(e.clientY));
  }
  function onSolPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) setViewHour(hourAtY(e.clientY));
  }
  function onSolKey(e: KeyboardEvent<HTMLDivElement>) {
    const from = solHour ?? first;
    const next =
      e.key === "ArrowUp" || e.key === "ArrowLeft"
        ? from - 0.25
        : e.key === "ArrowDown" || e.key === "ArrowRight"
          ? from + 0.25
          : e.key === "Home"
            ? first
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setPlaying(false);
    setViewHour(Math.min(last, Math.max(first, next)));
  }
  const blocks = today
    .filter((i) => i.type !== "deadline")
    .map((item) => {
      const start = hourOn(item.start, date);
      const end = item.end ? hourOn(item.end, date) : start + 0.5;
      const top = y(start) + 2;
      return { item, start, end, top, height: Math.max(32, (Math.min(end, last) - start) * ROW - 4) };
    });
  const boxes = blocks.map((b) => ({ id: b.item.id, top: b.top, bottom: b.top + b.height }));

  // Sol's top pick sits in its free gap as a dashed block, so the plan visibly makes room for it.
  let ghost: { item: DayItem; start: number; end: number; top: number; height: number } | null = null;
  if (suggestion && onAdd && parseLocal(suggestion.start).date === date) {
    const start = hourOn(suggestion.start, date);
    const end = suggestion.end ? hourOn(suggestion.end, date) : start + 1;
    const top = y(start) + 2;
    const h = Math.max(32, (Math.min(end, last) - start) * ROW - 4);
    const free = !boxes.some((b) => Math.min(top + h, b.bottom) - Math.max(top, b.top) > 4);
    if (free && start >= first && end <= last) ghost = { item: suggestion, start, end, top, height: h };
  }
  // Everything drawn as a block, Sol's pick included: deadline labels and the sunset label keep clear of these.
  const GHOST_ID = "sols-pick";
  const drawn = ghost ? [...boxes, { id: GHOST_ID, top: ghost.top, bottom: ghost.top + ghost.height }] : boxes;

  const pins: Pin[] = [];
  for (const item of today) {
    if (item.type === "deadline") {
      const due = hourOn(item.start, date);
      const at = Math.max(due, first); // a deadline before the first hour sits at the top edge
      const inBlock = coversOtherBlock(y(at), drawn, ""); // inside a class, an event or Sol's pick: short label in the lane
      const name = assignmentName(item.title);
      pins.push({
        key: item.id,
        itemId: item.id,
        at,
        // "Lab 7 due 11:59 pm" / "HW 9 turned in"; in the narrow lane beside a block, just "Lab 7 due" / ✓ HW 9.
        text: inBlock
          ? item.done
            ? name
            : `${name} due`
          : item.done
            ? `${name} turned in`
            : `${name} due ${formatTime(due)}`,
        // Maroon with a gold edge for work still due (orange means heat and nothing else); green once turned in.
        tone: item.done ? "bg-saguaro text-cloud" : "border-2 border-[#FFC627] bg-[#8C1D40] text-cloud",
        right: true,
        lane: inBlock,
        check: item.done,
      });
    }
    if (item.leaveAt && (item.type === "class" || item.type === "event")) {
      const leave = hourOn(item.leaveAt, date);
      const minutes = Math.max(1, Math.round((Date.parse(item.start) - Date.parse(item.leaveAt)) / 60_000));
      const crowded = coversOtherBlock(y(leave), boxes, item.id);
      const place = placeLabel(item.location) || item.title;
      pins.push({
        key: `${item.id}-leave`,
        itemId: item.id,
        at: leave,
        text: crowded
          ? `Leave ${formatTime(leave)} for ${place}`
          : `Leave ${formatTime(leave)} for ${place}, ${minutes} min`,
        tone: "bg-ink text-cloud",
        right: crowded,
      });
    }
  }
  const tops = stackPins(
    pins.map((pin) => y(pin.at)),
    height,
  );
  // Blocks that share their height with a lane label narrow, so the label sits beside their text.
  const narrowed = new Set(
    pins.flatMap((pin, k) =>
      pin.lane ? drawn.filter((b) => coversOtherBlock(tops[k] + PIN_HEIGHT / 2, [b], "")).map((b) => b.id) : [],
    ),
  );
  // The "Sunset 5:26 pm" words sit just above their dashed line; leave them out when a block is there.
  const sunsetY = y(sun.sunset);
  const sunsetLabel = !drawn.some((b) => b.top < sunsetY && b.bottom > sunsetY - 18);
  // Sol's caption goes above his line, or below it when he is at the very top of the sky (the sample's 8 am).
  const captionBelow = solHour !== null && y(solHour) < 44;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-pressed={playing}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 font-bold text-cloud hover:bg-ink/90"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
            {playing ? <rect x="3" y="3" width="10" height="10" rx="1.5" /> : <path d="M4 2.5v11l9.5-5.5z" />}
          </svg>
          {playing ? "Stop" : "Play my day"}
        </button>
        <p className="text-sm text-ink-soft">
          Sunrise {formatTime(sun.sunrise)}, sunset {formatTime(sun.sunset)} in Tempe
        </p>
      </div>

      <div
        ref={sky}
        className="relative overflow-hidden rounded-3xl border border-ink/15"
        style={{ height, background: skyBackground(y, hot, sun) }}
      >
      {hours.map((h) => (
        <div key={h} className="absolute inset-x-0" style={{ top: y(h) }} aria-hidden>
          <span
            className={`absolute left-3 -translate-y-1/2 text-xs ${isDarkHour(h, sun) ? "text-cloud/80" : "text-ink-soft"}`}
          >
            {formatTime(h)}
          </span>
          <div className="ml-16 border-t border-ink/10" />
        </div>
      ))}

      {/* The real Tempe sunset for this day; the sky's colors follow it. */}
      {sun.sunset > first && sun.sunset < last && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0" style={{ top: y(sun.sunset) }}>
          <div className="ml-16 border-t-2 border-dashed border-[#FFC627]/80" />
          {sunsetLabel && (
            <span className="absolute left-16 -translate-y-full pb-0.5 text-xs font-bold text-ink">
              Sunset {formatTime(sun.sunset)}
            </span>
          )}
        </div>
      )}

      <ol className="absolute inset-0">
        {ghost && onAdd && (
          <li
            className={`absolute left-16 ${narrowed.has(GHOST_ID) ? "right-[7.5rem]" : "right-3"}`}
            style={{ top: ghost.top, height: ghost.height }}
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => onAdd(ghost.item.id)}
              aria-label={`Add ${MASCOT}'s pick: ${ghost.item.title} at ${formatTime(ghost.start)}`}
              className="flex h-full w-full items-start justify-between gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-dusk bg-cloud/40 px-3 py-2 text-left hover:bg-cloud/70 disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold text-dusk">
                  {MASCOT}’s pick: {ghost.item.title}
                </span>
                {ghost.height >= 56 && (
                  <span className="block truncate text-sm text-ink-soft">
                    {rangeLabel(ghost.start, ghost.end)}
                    {ghost.item.location ? ` · ${placeLabel(ghost.item.location)}` : ""}
                  </span>
                )}
              </span>
              <span className="shrink-0 rounded-full bg-dusk px-3 py-1 text-sm font-bold text-cloud">+ Add</span>
            </button>
          </li>
        )}
        {blocks.map(({ item, start, end, top, height: blockHeight }) => {
          const selected = item.id === selectedId;
          const style =
            item.type === "class"
              ? "border border-ink/20 bg-cloud/75"
              : item.type === "study_block"
                ? "border-2 border-dashed border-sun bg-sun-soft"
                : item.type === "event"
                  ? "border-2 border-dusk bg-cloud shadow-[0_0_0_4px_rgba(255,176,0,0.35)]"
                  : "border border-ink/20 bg-ink/10";
          return (
            <li
              key={item.id}
              className={`absolute left-16 ${narrowed.has(item.id) ? "right-[7.5rem]" : "right-3"}`}
              style={{ top, height: blockHeight }}
            >
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={selected}
                className={`h-full w-full overflow-hidden rounded-2xl px-3 text-left ${blockHeight >= 56 ? "py-2" : "py-1.5"} ${style} ${selected ? "ring-4 ring-ink" : ""}`}
              >
                {/* Every block says when and where; short ones on a single line. */}
                {blockHeight >= 56 ? (
                  <>
                    <span className={`block font-bold leading-tight ${item.type === "event" ? "text-dusk" : ""}`}>
                      {blockTitle(item.title)}
                    </span>
                    <span className="block text-sm text-ink-soft">
                      {rangeLabel(start, end)}
                      {item.location ? ` · ${placeLabel(item.location)}` : ""}
                    </span>
                  </>
                ) : (
                  <span className="block truncate leading-snug">
                    <span className={`font-bold ${item.type === "event" ? "text-dusk" : ""}`}>{blockTitle(item.title)}</span>
                    <span className="text-sm text-ink-soft">
                      {" "}
                      · {rangeLabel(start, end)}
                      {item.location ? ` · ${placeLabel(item.location)}` : ""}
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}

        {pins.map((pin, k) => (
          <li
            key={pin.key}
            className={`pointer-events-none absolute left-16 right-3 z-10 flex ${pin.right ? "justify-end" : ""}`}
            style={{ top: tops[k] }}
          >
            <button
              type="button"
              onClick={() => onSelect(pin.itemId)}
              aria-pressed={pin.itemId === selectedId}
              className={`pointer-events-auto inline-flex h-7 items-center gap-1 rounded-full px-3 text-[13px] font-bold sm:text-sm ${
                pin.lane ? "max-w-[7rem]" : pin.right ? "max-w-[85%]" : "max-w-full"
              } ${pin.tone} ${pin.itemId === selectedId ? "ring-4 ring-sun" : ""}`}
            >
              {pin.check && (
                <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span className="truncate">{pin.text}</span>
            </button>
          </li>
        ))}
      </ol>

      {/* Sol on the sky: where "now" is, or where the day is while it plays. Drag him or use the arrow keys. */}
      {solHour !== null && (
        <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: y(solHour) }}>
          <div className="ml-14 mr-3 border-t-2 border-[#FFC627]" />
          <div
            ref={marker}
            role="slider"
            tabIndex={0}
            aria-label="Sol on your day"
            aria-valuemin={first}
            aria-valuemax={last}
            aria-valuenow={Math.round(solHour * 100) / 100}
            aria-valuetext={`${formatTime(solHour)}${viewHour !== null && caption ? `, ${caption}` : ""}`}
            onPointerDown={onSolPointerDown}
            onPointerMove={onSolPointerMove}
            onKeyDown={onSolKey}
            className="pointer-events-auto absolute left-2 top-0 -translate-y-1/2 cursor-grab touch-none rounded-full active:cursor-grabbing"
          >
            <Mascot size={40} mood={solMood} label="" />
          </div>
          {caption && (
            <p
              className={`absolute left-16 top-0 whitespace-nowrap rounded-full bg-cloud px-3 py-1 text-[13px] font-bold text-ink shadow-[0_6px_16px_-8px_rgba(20,50,74,0.6)] ${
                captionBelow ? "translate-y-1.5" : "-translate-y-[calc(100%+4px)]"
              }`}
            >
              {caption}
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
