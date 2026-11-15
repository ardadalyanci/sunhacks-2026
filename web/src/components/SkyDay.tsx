"use client";

import type { DayItem } from "@/lib/types";
import { PIN_HEIGHT, coversOtherBlock, dayBounds, hourOn, isDarkHour, skyBackground, stackPins } from "./sky-layout";
import { formatTime, parseLocal } from "./time";

const ROW = 56; // px per hour
const PAD = 14; // px above the first hour and below the last, so their labels are not clipped

type Pin = { key: string; itemId: string; at: number; text: string; tone: string; right?: boolean; lane?: boolean };

type Props = {
  date: string; // the plan's day ("2026-11-14"); items on other days are left out
  items: DayItem[];
  hot?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/**
 * One day as a column of sky: time of day is color, and every item sits at its hour. The sky covers 8 am to
 * 10 pm and stretches for anything earlier or later. Leave-time pins sit on the left, deadline pins on the
 * right, and pins that would touch are stacked so none overlap. A leave pin that would cover another block
 * (usually the study block that ends where the walk starts) moves right and drops the walk minutes. A deadline
 * that falls inside a block gets a short label ("Done 5 pm") in a lane at the right edge, and that block
 * narrows so the label never covers its text.
 */
export default function SkyDay({ date, items, hot = false, selectedId, onSelect }: Props) {
  const today = items.filter((i) => parseLocal(i.start).date === date);
  const { first, last } = dayBounds(today, date);
  const y = (hour: number) => PAD + (hour - first) * ROW;
  const height = PAD * 2 + (last - first) * ROW;
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const blocks = today
    .filter((i) => i.type !== "deadline")
    .map((item) => {
      const start = hourOn(item.start, date);
      const end = item.end ? hourOn(item.end, date) : start + 0.5;
      const top = y(start) + 2;
      return { item, start, end, top, height: Math.max(32, (Math.min(end, last) - start) * ROW - 4) };
    });
  const boxes = blocks.map((b) => ({ id: b.item.id, top: b.top, bottom: b.top + b.height }));

  const pins: Pin[] = [];
  for (const item of today) {
    if (item.type === "deadline") {
      const due = hourOn(item.start, date);
      const at = Math.max(due, first); // a deadline before the first hour sits at the top edge
      const inBlock = coversOtherBlock(y(at), boxes, ""); // inside a class or event: short label in the lane
      pins.push({
        key: item.id,
        itemId: item.id,
        at,
        text: inBlock
          ? `${item.done ? "Done" : "Due"} ${formatTime(due)}`
          : `${item.done ? "Turned in" : "Due"} ${formatTime(due)}: ${item.title}`,
        tone: item.done ? "bg-saguaro text-cloud" : "bg-[#c2410c] text-cloud",
        right: true,
        lane: inBlock,
      });
    }
    if (item.leaveAt && (item.type === "class" || item.type === "event")) {
      const leave = hourOn(item.leaveAt, date);
      const minutes = Math.max(1, Math.round((Date.parse(item.start) - Date.parse(item.leaveAt)) / 60_000));
      const crowded = coversOtherBlock(y(leave), boxes, item.id);
      const place = item.location ?? item.title;
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
      pin.lane ? boxes.filter((b) => coversOtherBlock(tops[k] + PIN_HEIGHT / 2, [b], "")).map((b) => b.id) : [],
    ),
  );

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-ink/15"
      style={{ height, background: skyBackground(y, hot) }}
    >
      {hours.map((h) => (
        <div key={h} className="absolute inset-x-0" style={{ top: y(h) }} aria-hidden>
          <span
            className={`absolute left-3 -translate-y-1/2 text-xs ${isDarkHour(h) ? "text-cloud/80" : "text-ink-soft"}`}
          >
            {formatTime(h)}
          </span>
          <div className="ml-16 border-t border-ink/10" />
        </div>
      ))}

      <ol className="absolute inset-0">
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
                className={`h-full w-full overflow-hidden rounded-2xl px-3 py-2 text-left ${style} ${selected ? "ring-4 ring-ink" : ""}`}
              >
                <span className={`block font-bold leading-tight ${item.type === "event" ? "text-dusk" : ""}`}>
                  {item.title}
                </span>
                {blockHeight >= 56 && (
                  <span className="block text-sm text-ink-soft">
                    {formatTime(start)} to {formatTime(end)}
                    {item.location ? `, ${item.location}` : ""}
                  </span>
                )}
              </button>
            </li>
          );
        })}

        {pins.map((pin, k) => (
          <li
            key={pin.key}
            className={`absolute left-16 right-3 z-10 flex ${pin.right ? "justify-end" : ""}`}
            style={{ top: tops[k] }}
          >
            <button
              type="button"
              onClick={() => onSelect(pin.itemId)}
              aria-pressed={pin.itemId === selectedId}
              className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-bold sm:text-sm ${
                pin.lane ? "max-w-[7rem]" : pin.right ? "max-w-[85%]" : "max-w-full"
              } ${pin.tone} ${pin.itemId === selectedId ? "ring-4 ring-sun" : ""}`}
            >
              <span className="truncate">{pin.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
