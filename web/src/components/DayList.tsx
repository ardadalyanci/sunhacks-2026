"use client";

import type { DayItem } from "@/lib/types";

type Props = {
  date: string; // the plan's day ("2026-11-14")
  items: DayItem[];
  nowMs: number; // the day's "now" (the sample replays 8 am; a real day uses the clock)
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** The day as a plain, large, chronological list: the same facts as the sky timeline. */
export default function DayList(_props: Props) {
  return null;
}
