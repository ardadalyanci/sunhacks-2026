"use client";

import type { useDay } from "./useDay";

type Props = {
  day: ReturnType<typeof useDay>;
};

/** The "What if…" pills under the day picker. For now only the heat preview. */
export default function WhatIfBar({ day }: Props) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={day.hot}
        disabled={day.busy}
        onClick={() => void day.setHotPreview(!day.hot)}
        className={`rounded-full border-2 px-4 py-2 font-bold disabled:opacity-50 ${
          day.hot ? "border-[#F97316] bg-[#F97316] text-ink" : "border-ink/20 bg-cloud hover:border-ink"
        }`}
      >
        What if it’s 104°?
      </button>
    </div>
  );
}
