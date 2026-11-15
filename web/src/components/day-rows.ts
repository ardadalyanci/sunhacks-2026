// The day as a flat, time-ordered list of rows for DayList: the same facts and words as the sky, so a student
// who switches views (zoom, low vision, a screen reader) never reads a different time or name.
// No React here, so the rules are easy to test.
import { placeLabel } from "@/lib/places";
import type { DayItem } from "@/lib/types";
import { assignmentName, blockTitle, hourOn, rangeLabel } from "./sky-layout";
import { formatTime, parseLocal } from "./time";

export type RowKind = "leave" | "block" | "study" | "deadline";

export type DayRow = {
  key: string;
  itemId: string; // the DayItem the row belongs to; selecting the row selects it
  kind: RowKind;
  atMs: number; // when the row happens: the leave time, the start or the due time
  time: string; // "9:47 am", "10 am–2 pm"
  title: string; // "Leave for the MU", "Work shift", "Lab 7 due"
  detail: string; // "13-minute walk", "the MU", "not turned in yet"; may be empty
  label?: string; // a small tag before the title: "Event" for events added from Sol's picks
  done?: boolean; // deadlines: turned in
  next?: boolean; // the first row still ahead of now
  past?: boolean; // over before now; a class or study block in progress is not past until it ends
};

/** Leave rows go before the block they lead to when the times tie; everything else keeps its input order. */
const RANK: Record<RowKind, number> = { leave: 0, block: 1, study: 1, deadline: 1 };

/** Every row on `date` in time order, with the first row still ahead of `nowMs` marked `next`. */
export function dayRows(items: DayItem[], date: string, nowMs: number): DayRow[] {
  const rows: (DayRow & { endMs: number })[] = [];
  for (const item of items) {
    if (parseLocal(item.start).date !== date) continue;
    const startMs = Date.parse(item.start);
    const start = hourOn(item.start, date);

    if (item.type === "deadline") {
      const name = assignmentName(item.title);
      rows.push({
        key: item.id,
        itemId: item.id,
        kind: "deadline",
        atMs: startMs,
        endMs: startMs,
        time: formatTime(start),
        title: item.done ? name : `${name} due`,
        detail: item.done ? "turned in" : "not turned in yet",
        done: Boolean(item.done),
      });
      continue;
    }

    // Only classes (commitments are classes too) and events get a walk, as on the sky.
    if (item.leaveAt && (item.type === "class" || item.type === "event")) {
      const leaveMs = Date.parse(item.leaveAt);
      const minutes = Math.max(1, Math.round((startMs - leaveMs) / 60_000));
      rows.push({
        key: `${item.id}-leave`,
        itemId: item.id,
        kind: "leave",
        atMs: leaveMs,
        endMs: leaveMs,
        time: formatTime(hourOn(item.leaveAt, date)),
        title: `Leave for ${placeLabel(item.location) || item.title}`,
        detail: `${minutes}-minute walk`,
      });
    }

    const endMs = item.end ? Date.parse(item.end) : startMs;
    const time = item.end ? rangeLabel(start, hourOn(item.end, date)) : formatTime(start);
    const place = placeLabel(item.location);
    if (item.type === "study_block") {
      // "Work on Lab 7 · CSE 230" from the sky's wording, split into the task and its course.
      const [title, ...course] = blockTitle(item.title).split(" · ");
      rows.push({
        key: item.id,
        itemId: item.id,
        kind: "study",
        atMs: startMs,
        endMs,
        time,
        title,
        detail: [...course, place].filter(Boolean).join(" · "),
      });
    } else {
      rows.push({
        key: item.id,
        itemId: item.id,
        kind: "block",
        atMs: startMs,
        endMs,
        time,
        title: blockTitle(item.title),
        detail: place,
        label: item.type === "event" ? "Event" : undefined,
      });
    }
  }

  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.atMs - b.row.atMs || RANK[a.row.kind] - RANK[b.row.kind] || a.index - b.index)
    .map(({ row }) => row);

  // Before the browser has a clock (the first render), nothing is next and nothing is past.
  const clock = Number.isFinite(nowMs) && nowMs > 0;
  let marked = false;
  return sorted.map(({ endMs, ...row }) => {
    if (!clock) return row;
    const next = !marked && row.atMs >= nowMs;
    if (next) marked = true;
    return { ...row, ...(next ? { next: true } : {}), ...(endMs < nowMs ? { past: true } : {}) };
  });
}
