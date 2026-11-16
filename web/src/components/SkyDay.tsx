"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { buildingWord, findPlace, placeLabel } from "@/lib/places";
import type { DayItem } from "@/lib/types";
import Mascot from "./Mascot";
import { MASCOT } from "./brand";
import {
  assignmentName,
  blockTitle,
  captionSpot,
  dayBounds,
  dayStops,
  hourOn,
  isDarkHour,
  layoutPins,
  narrowedBlocks,
  rangeLabel,
  skyBackground,
  stopAt,
  sunTimes,
} from "./sky-layout";
import { formatTime, parseLocal } from "./time";

const ROW = 64; // px per hour: the sample day's sky is about 750 px tall, and a 50-minute class has room for two lines
const PAD = 14; // px above the first hour and below the last, so their labels are not clipped
const PAD_FOR_CAPTION = 46; // px above the first hour when Sol rests on it, so his "Now, 8 am" sits in open sky
const PLAY_SECONDS = 14; // "Play my day" runs the whole day in this long
// The lane at the right edge for pins that sit beside a block, and where a block beside it ends. Wider from sm
// up, so "Reading response due" fits whole on a laptop; a phone keeps its blocks wide enough for their room.
const LANE_WIDTH = "max-w-[7rem] sm:max-w-[11rem]";
const LANE_BESIDE = "right-[7.5rem] sm:right-[11.5rem]";
// Sol's slider keys, in hours: arrows a quarter hour, PageUp and PageDown a whole hour.
const KEY_STEPS: Record<string, number> = { ArrowUp: -0.25, ArrowLeft: -0.25, ArrowDown: 0.25, ArrowRight: 0.25, PageUp: -1, PageDown: 1 };

// `text` is the full label; `short` is what it says in the narrow lane at the right edge, beside a block.
type Pin = { key: string; itemId: string; at: number; text: string; short: string; tone: string; right: boolean; check?: boolean };

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

/** Lines of 20 px text that fit in a block `height` px tall, after its padding and `other` px of other lines. */
function linesThatFit(height: number, other: number): number {
  return Math.max(1, Math.floor((height - (height >= 60 ? 20 : 12) - other + 6) / 20));
}

/** "Brickyard" from "Brickyard 210": a pin or caption names the building, the block already shows the room. */
function buildingOf(location: string | undefined): string {
  const { building } = findPlace(location);
  return building ? buildingWord(building) : placeLabel(location);
}

/**
 * One day as a column of sky: time of day is color, and every item sits at its hour. The sky starts at 8 am
 * (earlier for an early class) and ends an hour after the sunset or the last block, whichever is later.
 * Leave-time pins sit on the left, deadline pins on the right, and pins that would touch are stacked so none
 * overlap. A pin that lands on a block's text (a leave pin on the study block before the walk, a deadline
 * inside a class) moves into a lane at the right edge with a short label ("Leave 1:25 pm", "Lab 7 due"), and
 * that block narrows so the label never covers its text.
 */
export default function SkyDay({ date, items, hot = false, nowHour, suggestion, onAdd, busy = false, selectedId, onSelect }: Props) {
  const today = items.filter((i) => parseLocal(i.start).date === date);
  const sun = useMemo(() => sunTimes(date), [date]);
  const bounds = dayBounds(today, date, sun, nowHour);
  const first = bounds.first;
  // When Sol rests on the first hour (the sample's 8 am), the sky gets room above it for his caption, which
  // would otherwise sit on the first block's title.
  const padTop = nowHour !== undefined && nowHour >= first && nowHour - first < 0.5 ? PAD_FOR_CAPTION : PAD;
  const y = (hour: number) => padTop + (hour - first) * ROW;

  const blocks = today
    .filter((i) => i.type !== "deadline")
    .map((item) => {
      const start = hourOn(item.start, date);
      const end = item.end ? hourOn(item.end, date) : start + 0.5;
      const top = y(start) + 2;
      return { item, start, end, top, height: Math.max(32, (end - start) * ROW - 4) };
    });
  // A block's text is centered in it (one or two lines, or a two-line title and its time from 80 px), so a tall
  // block has empty room above and below its text where a pin may sit without narrowing it.
  const boxes = blocks.map((b) => ({
    id: b.item.id,
    top: b.top,
    bottom: b.top + b.height,
    pad: Math.max(8, (b.height - (b.height >= 80 ? 64 : 44)) / 2),
  }));

  // Sol's top pick sits in its free gap as a dashed block, so the plan visibly makes room for it.
  let ghost: { item: DayItem; start: number; end: number; top: number; height: number } | null = null;
  if (suggestion && onAdd && parseLocal(suggestion.start).date === date) {
    const start = hourOn(suggestion.start, date);
    const end = suggestion.end ? hourOn(suggestion.end, date) : start + 1;
    const top = y(start) + 2;
    const h = Math.max(32, (end - start) * ROW - 4);
    const free = !boxes.some((b) => Math.min(top + h, b.bottom) - Math.max(top, b.top) > 4);
    if (free && start >= first && end < 24) ghost = { item: suggestion, start, end, top, height: h };
  }
  // The pick is a block too, so the sky also reaches an hour past it.
  const last = ghost ? Math.min(24, Math.max(bounds.last, Math.ceil(ghost.end + 1))) : bounds.last;
  const height = padTop + PAD + (last - first) * ROW;
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  // "Play my day": Sol rides the sky from the first hour to the last, stopping on each walk and deadline.
  const stops = useMemo(
    () => dayStops(items.filter((i) => parseLocal(i.start).date === date), date, sunTimes(date), buildingOf),
    [items, date],
  );
  // The play reads the latest stops from here, so a re-render of the page (the clock tick) does not restart it.
  const stopsRef = useRef(stops);
  useEffect(() => {
    stopsRef.current = stops;
  }, [stops]);
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
      if (reduce) hour = [...stopsRef.current].reverse().find((s) => s.hour <= hour)?.hour ?? first; // jump stop to stop
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
  }, [playing, first, last]);

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
    return Math.min(last, Math.max(first, first + (clientY - top - padTop) / ROW));
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
    // Home and End go to the ends of the sky.
    const step = KEY_STEPS[e.key];
    const next = step !== undefined ? from + step : e.key === "Home" ? first : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    setPlaying(false);
    setViewHour(Math.min(last, Math.max(first, next)));
  }
  // Everything drawn as a block, Sol's pick included: deadline labels and the sunset label keep clear of these.
  const GHOST_ID = "sols-pick";
  const drawn = ghost ? [...boxes, { id: GHOST_ID, top: ghost.top, bottom: ghost.top + ghost.height }] : boxes;

  const pins: Pin[] = [];
  for (const item of today) {
    if (item.type === "deadline") {
      const due = hourOn(item.start, date);
      const at = Math.min(Math.max(due, first), last); // a deadline before the first hour or after the last sits at that edge
      const name = assignmentName(item.title);
      pins.push({
        key: item.id,
        itemId: item.id,
        at,
        // "Lab 7 due 11:59 pm" / "HW 9 turned in"; in the narrow lane beside a block, just "Lab 7 due" / ✓ HW 9.
        text: item.done ? `${name} turned in` : `${name} due ${formatTime(due)}`,
        short: item.done ? name : `${name} due`,
        // Maroon with a gold edge for work still due (orange means heat and nothing else); green once turned in.
        tone: item.done ? "bg-saguaro text-cloud" : "border-2 border-[#FFC627] bg-[#8C1D40] text-cloud",
        right: true,
        check: item.done,
      });
    }
    if (item.leaveAt && (item.type === "class" || item.type === "event")) {
      const leave = hourOn(item.leaveAt, date);
      const minutes = Math.max(1, Math.round((Date.parse(item.start) - Date.parse(item.leaveAt)) / 60_000));
      pins.push({
        key: `${item.id}-leave`,
        itemId: item.id,
        at: leave,
        text: `Leave ${formatTime(leave)} for ${buildingOf(item.location) || item.title}, ${minutes} min${
          item.via ? (item.via.includes("shuttle") ? " by shuttle" : " from home") : ""
        }`,
        short: `Leave ${formatTime(leave)}`,
        tone: "bg-ink text-cloud",
        right: false,
      });
    }
  }
  // Stack the pins first, then decide which ones land on a block: those move into the lane, and the block narrows.
  const spots = layoutPins(
    pins.map((pin) => ({ center: y(pin.at), ownId: pin.itemId })),
    height,
    drawn,
  );
  const narrowed = narrowedBlocks(spots, drawn);
  // The "Sunset 5:26 pm" words sit just above their dashed line; leave them out when a block is there.
  const sunsetY = y(sun.sunset);
  const sunsetLabel = !drawn.some((b) => b.top < sunsetY && b.bottom > sunsetY - 18);
  // Sol's caption goes above his line (below it when there is no room), and moves below or to the other side
  // when a pin is there, so "Leave now for Hayden" never covers the leave pin.
  const spot =
    solHour !== null
      ? captionSpot(
          y(solHour),
          spots.map((s, k) => ({ top: s.top, right: s.lane || pins[k].right })),
          height,
          viewHour === null ? drawn : [], // at rest the caption stays put, so it also keeps off the blocks' text
        )
      : { below: false, right: false };

  // Sol's pick, in time order among the blocks so Tab and a screen reader meet it at its hour. On a phone the
  // event's name gets the room (its time line shows only in a tall block); from sm up, one line and the time.
  const pickLines = ghost
    ? ({
        "--lines": ghost.height >= 48 ? linesThatFit(ghost.height, ghost.height >= 80 ? 20 : 0) : 1,
        "--sm-lines": ghost.height >= 80 ? linesThatFit(ghost.height, 20) : 1,
      } as CSSProperties)
    : undefined;
  const ghostNode = ghost && onAdd && (
    <li
      key={GHOST_ID}
      className={`absolute left-16 ${narrowed.has(GHOST_ID) ? LANE_BESIDE : "right-3"}`}
      style={{ top: ghost.top, height: ghost.height }}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => onAdd(ghost.item.id)}
        aria-label={`Add ${MASCOT}'s pick: ${ghost.item.title} at ${formatTime(ghost.start)}`}
        className={`flex h-full w-full items-start justify-between gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-dusk bg-cloud/40 pl-3 text-left hover:bg-cloud/70 disabled:opacity-60 ${
          ghost.height >= 60 ? "py-2" : "py-1"
        } ${narrowed.has(GHOST_ID) ? "pr-1.5" : "pr-3"}`}
      >
        <span className="min-w-0">
          {/* Below sm the "Sol's pick" words go: the dashed border and the button's label already say it. */}
          <span
            className="line-clamp-(--lines) font-bold leading-tight text-dusk sm:line-clamp-(--sm-lines)"
            style={pickLines}
          >
            <span className="hidden sm:inline">{MASCOT}’s pick: </span>
            {ghost.item.title}
          </span>
          {ghost.height >= 48 && (
            <span className={`truncate text-sm text-ink-soft ${ghost.height >= 80 ? "block" : "hidden sm:block"}`}>
              {rangeLabel(ghost.start, ghost.end)}
              {ghost.item.location ? ` · ${placeLabel(ghost.item.location)}` : ""}
            </span>
          )}
        </span>
        <span
          className={`shrink-0 rounded-full bg-dusk py-1 text-sm font-bold text-cloud ${narrowed.has(GHOST_ID) ? "px-2.5" : "px-3"}`}
        >
          {narrowed.has(GHOST_ID) ? "+" : "+ Add"}
        </span>
      </button>
    </li>
  );
  const ghostBefore = ghost ? blocks.findIndex((b) => b.start > ghost.start) : -1;

  return (
    <div>
      <h2 className="sr-only">Your day, hour by hour</h2>
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
          {/* Full ink on the light sky (it passes contrast on the hot afternoon and the 6 pm lavender too). The label
              Sol sits on fades out, so the scale does not seem to start an hour late. */}
          <span
            className={`absolute left-3 -translate-y-1/2 text-xs transition-opacity motion-reduce:transition-none ${
              isDarkHour(h, sun) ? "text-cloud/80" : "text-ink"
            } ${solHour !== null && Math.abs(h - solHour) < 0.4 ? "opacity-0" : ""}`}
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

      {/* Sol on the sky: where "now" is, or where the day is while it plays. Drag him or use the arrow keys. He comes
          before the list, so Tab reaches him first, as the eye does; z-20 keeps him drawn on top. */}
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
              className={`absolute top-0 whitespace-nowrap rounded-full bg-cloud px-3 py-1 text-[13px] font-bold text-ink shadow-[0_6px_16px_-8px_rgba(20,50,74,0.6)] ${
                spot.right ? "right-3" : "left-16"
              } ${spot.below ? "translate-y-1.5" : "-translate-y-[calc(100%+4px)]"}`}
            >
              {caption}
            </p>
          )}
        </div>
      )}

      <ol aria-label="Your day, hour by hour" className="absolute inset-0">
        {blocks.map(({ item, start, end, top, height: blockHeight }, k) => {
          const selected = item.id === selectedId;
          const style =
            item.type === "class"
              ? "border border-ink/20 bg-cloud/75"
              : item.type === "study_block"
                ? "border-2 border-dashed border-sun bg-sun-soft"
                : item.type === "event"
                  ? "border-2 border-dusk bg-cloud shadow-[0_0_0_4px_rgba(255,176,0,0.35)]"
                  : "border border-ink/20 bg-ink/10";
          const where = item.location ? placeLabel(item.location) : "";
          // The leave time is the point of the class, so a screen reader hears it with the class, not after the day.
          const leave = item.leaveAt && (item.type === "class" || item.type === "event") ? hourOn(item.leaveAt, date) : null;
          const label = `${blockTitle(item.title)}, ${rangeLabel(start, end)}${where ? `, ${where}` : ""}${
            leave !== null ? `. Leave at ${formatTime(leave)}` : ""
          }`;
          const twoLines = blockHeight >= 48; // a 50-minute class: its time and room on their own line
          return (
            <Fragment key={item.id}>
              {k === ghostBefore && ghostNode}
              <li
                className={`absolute left-16 ${narrowed.has(item.id) ? LANE_BESIDE : "right-3"}`}
                style={{ top, height: blockHeight }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-pressed={selected}
                  aria-label={label}
                  className={`h-full w-full overflow-hidden rounded-2xl px-3 text-left ${
                    blockHeight >= 60 ? "py-2" : twoLines ? "py-1" : "py-1.5"
                  } ${style} ${selected ? "ring-4 ring-ink" : ""}`}
                >
                  {/* Every block says when and where; short ones on a single line. */}
                  {twoLines ? (
                    <>
                      <span
                        className={`font-bold leading-tight ${blockHeight >= 80 ? "line-clamp-2" : "block truncate"} ${
                          item.type === "event" ? "text-dusk" : ""
                        }`}
                      >
                        {blockTitle(item.title)}
                      </span>
                      <span className="block truncate text-sm text-ink-soft">
                        {rangeLabel(start, end)}
                        {where ? ` · ${where}` : ""}
                      </span>
                    </>
                  ) : (
                    <span className="block truncate leading-snug">
                      <span className={`font-bold ${item.type === "event" ? "text-dusk" : ""}`}>{blockTitle(item.title)}</span>
                      <span className="text-sm text-ink-soft">
                        {" "}
                        · {rangeLabel(start, end)}
                        {where ? ` · ${where}` : ""}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            </Fragment>
          );
        })}
        {ghostBefore === -1 && ghostNode}

        {pins.map((pin, k) => {
          const lane = spots[k].lane;
          return (
            <li
              key={pin.key}
              className={`pointer-events-none absolute left-16 right-3 z-10 flex ${lane || pin.right ? "justify-end" : ""}`}
              style={{ top: spots[k].top }}
            >
              {/* 28 px to look at, 40 px to tap: the ::before strip reaches 6 px above and below the pill. */}
              <button
                type="button"
                onClick={() => onSelect(pin.itemId)}
                aria-pressed={pin.itemId === selectedId}
                className={`pointer-events-auto relative inline-flex h-7 items-center gap-1 rounded-full px-3 text-[13px] font-bold before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] sm:text-sm ${
                  lane ? LANE_WIDTH : pin.right ? "max-w-[85%]" : "max-w-full"
                } ${pin.tone} ${pin.itemId === selectedId ? "ring-4 ring-sun" : ""}`}
              >
                {pin.check && (
                  <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span className="truncate">{lane ? pin.short : pin.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
      </div>
    </div>
  );
}
