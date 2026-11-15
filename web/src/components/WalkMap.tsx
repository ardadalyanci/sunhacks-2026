"use client";

import type { DayItem } from "@/lib/types";

type Props = {
  date: string; // the plan's day ("2026-11-14")
  items: DayItem[];
  startBuildingId?: string; // where the day starts (a building id), when the student set one
  hot: boolean;
  nextItemId: string | null; // the class or event the next walk goes to
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** The day's walks on a map, with the minutes for each leg. */
export default function WalkMap(_props: Props) {
  return null;
}
