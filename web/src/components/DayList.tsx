"use client";

import type { DayItem } from "@/lib/types";
import { dayRows, type DayRow } from "./day-rows";

type Props = {
  date: string; // the plan's day ("2026-11-14")
  items: DayItem[];
  nowMs: number; // the day's "now" (the sample replays 8 am; a real day uses the clock)
  selectedId: string | null;
  onSelect: (id: string) => void;
};

// Each kind keeps its look from the sky: dashed gold for study, purple for events, maroon for work still due
// and green once turned in. Past rows lose their white card and switch to ink-soft, which still reads at
// better than 4.5:1 on the page's sky blue (a plain opacity fade would not).
function rowStyle(row: DayRow): string {
  const card = row.past ? "bg-cloud/50" : "bg-cloud";
  if (row.kind === "deadline") return `${card} border-2 ${row.done ? "border-saguaro text-saguaro" : "border-[#8C1D40] text-[#8C1D40]"}`;
  if (row.kind === "study") return `border-2 border-dashed border-sun ${row.past ? "bg-sun-soft/50 text-ink-soft" : "bg-sun-soft"}`;
  if (row.label) return `${card} border-2 border-dusk ${row.past ? "text-ink-soft" : ""}`;
  return `${card} border-2 border-ink/15 ${row.past ? "text-ink-soft" : ""}`;
}

function Icon({ row }: { row: DayRow }) {
  if (row.kind === "leave") {
    // A walking arrow, so a leave row reads as "go" at a glance.
    return (
      <svg aria-hidden viewBox="0 0 16 16" className="mr-1.5 inline h-4 w-4 align-[-1px]" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 8h11M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (row.kind === "deadline" && row.done) {
    return (
      <svg aria-hidden viewBox="0 0 16 16" className="mr-1.5 inline h-4 w-4 align-[-1px]" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}

/** The day as a plain, large, chronological list: the same facts as the sky timeline. */
export default function DayList({ date, items, nowMs, selectedId, onSelect }: Props) {
  const rows = dayRows(items, date, nowMs);
  if (rows.length === 0) return <p className="rounded-3xl bg-cloud p-5 text-lg">Nothing on this day yet.</p>;

  return (
    <ol aria-label="Your day as a list" className="space-y-2">
      {rows.map((row) => {
        const selected = row.itemId === selectedId;
        return (
          <li key={row.key}>
            <button
              type="button"
              onClick={() => onSelect(row.itemId)}
              aria-pressed={selected}
              aria-current={row.next ? "true" : undefined}
              className={`flex min-h-12 w-full flex-col gap-1 rounded-2xl px-4 py-3 text-left text-lg leading-snug hover:brightness-[0.97] sm:flex-row sm:items-baseline sm:gap-4 ${rowStyle(row)} ${
                selected ? "ring-4 ring-ink" : ""
              }`}
            >
              {row.past && <span className="sr-only">Earlier: </span>}
              <span className="flex shrink-0 flex-wrap items-center gap-2 sm:w-52">
                {row.next && <span className="rounded-full bg-[#FFC627] px-2.5 py-0.5 text-sm font-bold text-ink">Next</span>}
                <span className="font-display font-bold">{row.time}</span>
              </span>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {row.label && (
                  <span className="mr-2 inline-block rounded-full bg-dusk px-2.5 py-0.5 align-middle text-sm font-bold text-cloud">
                    {row.label}
                  </span>
                )}
                <span className="font-bold">
                  <Icon row={row} />
                  {row.title}
                </span>
                {row.detail && <span className={row.kind === "deadline" ? "" : "text-ink-soft"}> · {row.detail}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
