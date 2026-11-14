"use client";

import type { DayItem } from "@/lib/types";
import { formatTime, parseLocal } from "./time";

const START = 8; // 8 am (planner DAY_START)
const END = 22; // 10 pm (planner DAY_END)
const ROW = 56; // px per hour
const PAD = 12; // px above 8 am so its label is not clipped

const hourOf = (iso: string) => parseLocal(iso).hours;
const inDay = (h: number) => h >= START && h <= END;
const y = (hours: number) => PAD + (Math.min(Math.max(hours, START), END) - START) * ROW;

type Pin = { key: string; itemId: string; at: number; text: string; tone: string; right?: boolean };

type Props = {
  items: DayItem[];
  hot?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** One day as a column of sky: time of day is color, and every item sits at its hour. */
export default function SkyDay({ items, hot = false, selectedId, onSelect }: Props) {
  const hours = Array.from({ length: END - START + 1 }, (_, i) => START + i);
  const blocks = items.filter((i) => i.type !== "deadline" && inDay(hourOf(i.start)));

  const pins: Pin[] = [];
  for (const item of items) {
    if (item.type === "deadline") {
      const at = hourOf(item.start);
      if (inDay(at)) {
        pins.push({
          key: item.id,
          itemId: item.id,
          at,
          text: `${item.done ? "Turned in" : "Due"} ${formatTime(at)}: ${item.title}`,
          tone: item.done ? "bg-saguaro text-cloud" : "bg-[#c2410c] text-cloud",
          right: true, // keeps deadline pins off the titles of blocks at the same hour
        });
      }
    }
    if (item.leaveAt && (item.type === "class" || item.type === "event")) {
      const at = hourOf(item.leaveAt);
      const minutes = Math.max(1, Math.round((Date.parse(item.start) - Date.parse(item.leaveAt)) / 60_000));
      if (inDay(at)) {
        pins.push({
          key: `${item.id}-leave`,
          itemId: item.id,
          at,
          text: `Leave ${formatTime(at)} for ${item.location ?? item.title}, ${minutes} min`,
          tone: "bg-ink text-cloud",
        });
      }
    }
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-ink/15 ${hot ? "sky-day-hot" : "sky-day"}`}
      style={{ height: PAD * 2 + (END - START) * ROW }}
    >
      {hours.map((h) => (
        <div key={h} className="absolute inset-x-0" style={{ top: y(h) }} aria-hidden>
          <span className={`absolute left-3 -translate-y-1/2 text-xs ${h >= 19 ? "text-cloud/80" : "text-ink-soft"}`}>
            {formatTime(h)}
          </span>
          <div className="ml-16 border-t border-ink/10" />
        </div>
      ))}

      <ol className="absolute inset-0">
        {blocks.map((item) => {
          const start = hourOf(item.start);
          const end = item.end ? hourOf(item.end) : start + 0.5;
          const height = Math.max(32, (Math.min(end, END) - start) * ROW - 4);
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
            <li key={item.id} className="absolute left-16 right-3" style={{ top: y(start) + 2, height }}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={selected}
                className={`h-full w-full overflow-hidden rounded-2xl px-3 py-2 text-left ${style} ${selected ? "ring-4 ring-ink" : ""}`}
              >
                <span className={`block font-bold leading-tight ${item.type === "event" ? "text-dusk" : ""}`}>
                  {item.title}
                </span>
                {height >= 56 && (
                  <span className="block text-sm text-ink-soft">
                    {formatTime(start)} to {formatTime(end)}
                    {item.location ? `, ${item.location}` : ""}
                  </span>
                )}
              </button>
            </li>
          );
        })}

        {pins.map((pin) => (
          <li
            key={pin.key}
            className={`absolute left-16 right-3 z-10 flex ${pin.right ? "justify-end" : ""}`}
            style={{ top: y(pin.at) - 14 }}
          >
            <button
              type="button"
              onClick={() => onSelect(pin.itemId)}
              aria-pressed={pin.itemId === selectedId}
              className={`inline-flex h-7 max-w-full items-center rounded-full px-3 text-xs font-bold sm:text-sm ${pin.tone} ${
                pin.itemId === selectedId ? "ring-4 ring-sun" : ""
              }`}
            >
              <span className="truncate">{pin.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
