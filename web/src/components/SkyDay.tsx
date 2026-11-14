"use client";

import type { DayItem } from "@/lib/types";
import { formatTime, parseLocal } from "./time";

const START = 8; // 8 am
const END = 21; // 9 pm
const ROW = 56; // px per hour
const PAD = 12; // px above 8 am so its label is not clipped

function hourOf(iso: string) {
  return parseLocal(iso).hours;
}

function y(hours: number) {
  return PAD + (Math.min(Math.max(hours, START), END) - START) * ROW;
}

type Props = {
  items: DayItem[];
  hot?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** One day as a column of sky: time of day is color, and every item sits at its hour. */
export default function SkyDay({ items, hot = false, selectedId, onSelect }: Props) {
  const hours = Array.from({ length: END - START + 1 }, (_, i) => START + i);
  const visible = items.filter((item) => {
    const at = item.startsAt ?? item.dueAt;
    if (!at) return false;
    const h = hourOf(at);
    return h >= START && h <= END;
  });

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-ink/15 ${hot ? "sky-day-hot" : "sky-day"}`}
      style={{ height: PAD * 2 + (END - START) * ROW }}
    >
      {hours.map((h) => (
        <div key={h} className="absolute inset-x-0" style={{ top: y(h) }} aria-hidden>
          <span
            className={`absolute left-3 -translate-y-1/2 text-xs ${h >= 19 ? "text-cloud/80" : "text-ink-soft"}`}
          >
            {formatTime(h)}
          </span>
          <div className="ml-16 border-t border-ink/10" />
        </div>
      ))}

      <ol className="absolute inset-0">
        {visible.map((item) => {
          const selected = item.id === selectedId;
          const ring = selected ? "ring-4 ring-ink" : "";

          if (item.kind === "leave" || item.kind === "assignment") {
            const at = hourOf((item.startsAt ?? item.dueAt)!);
            const isLeave = item.kind === "leave";
            return (
              <li key={item.id} className="absolute left-16 right-3" style={{ top: y(at) - 14 }}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-pressed={selected}
                  className={`inline-flex h-7 max-w-full items-center rounded-full px-3 text-xs font-bold sm:text-sm ${ring} ${
                    isLeave ? "bg-ink text-cloud" : "bg-saguaro text-cloud"
                  }`}
                >
                  <span className="truncate">
                    {isLeave
                      ? `Leave ${formatTime(at)} for ${item.title.replace("Leave for ", "")}, ${item.walkMinutes} min walk`
                      : `${item.submitted ? "Turned in" : "Due"} ${formatTime(at)}: ${item.title}`}
                  </span>
                </button>
              </li>
            );
          }

          const start = hourOf(item.startsAt!);
          const end = item.endsAt ? hourOf(item.endsAt) : start + 1;
          const height = Math.max(32, (Math.min(end, END) - start) * ROW - 4);
          const style =
            item.kind === "class"
              ? "border border-ink/20 bg-cloud/70"
              : item.kind === "study"
                ? "border-2 border-dashed border-sun bg-sun-soft"
                : "border-2 border-dusk bg-cloud shadow-[0_0_0_4px_rgba(255,176,0,0.35)]";
          return (
            <li key={item.id} className="absolute left-16 right-3" style={{ top: y(start) + 2, height }}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={selected}
                className={`h-full w-full overflow-hidden rounded-2xl px-3 py-2 text-left ${style} ${ring}`}
              >
                <span className={`block font-bold leading-tight ${item.kind === "event" ? "text-dusk" : ""}`}>
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
      </ol>
    </div>
  );
}
