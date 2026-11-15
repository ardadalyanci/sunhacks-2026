"use client";

import type { ReactNode } from "react";
import Mascot from "./Mascot";
import type { useDay } from "./useDay";

type Props = {
  day: ReturnType<typeof useDay>;
};

type PillProps = {
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
  onClass: string; // the fill while the pill is on
  children: ReactNode;
};

/** One on/off "What if…" pill. A check mark shows it is on, so the state never rests on color alone. */
function Pill({ on, disabled, onToggle, onClass, children }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onToggle}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 px-4 py-2 text-left font-bold leading-tight disabled:opacity-50 ${
        on ? onClass : "border-ink/20 bg-cloud hover:border-ink"
      }`}
    >
      {on && (
        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
          <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

/**
 * The "What if…" pills under the day picker: heat, oversleeping and a cancelled class, in any combination.
 * Under them, Sol says in one line what the last change moved and what it did not.
 */
export default function WhatIfBar({ day }: Props) {
  const { whatIf, busy, skip, skipKey, change } = day;
  return (
    <div className="mt-3">
      <div role="group" aria-label="What if…" className="flex flex-wrap gap-2">
        <Pill
          on={whatIf.hot}
          disabled={busy}
          onToggle={() => void day.setWhatIf({ hot: !whatIf.hot })}
          onClass="border-[#F97316] bg-[#F97316] text-ink"
        >
          What if it’s 104°?
        </Pill>
        <Pill
          on={whatIf.overslept}
          disabled={busy}
          onToggle={() => void day.setWhatIf({ overslept: !whatIf.overslept })}
          onClass="border-ink bg-ink text-cloud"
        >
          What if I oversleep?
        </Pill>
        {skip && skipKey && (
          <Pill
            on={whatIf.skipped !== null}
            disabled={busy}
            onToggle={() => void day.setWhatIf({ skipped: whatIf.skipped ? null : skipKey })}
            onClass="border-ink bg-ink text-cloud"
          >
            What if {skip} is cancelled?
          </Pill>
        )}
      </div>
      {/* Always in the page, so screen readers hear each new note as it arrives. */}
      <div aria-live="polite">
        {change && (
          <p className="mt-3 flex max-w-prose items-start gap-3 rounded-2xl bg-sun-soft px-4 py-3">
            <Mascot size={32} label="" className="mt-0.5 shrink-0" />
            <span>{change}</span>
          </p>
        )}
      </div>
    </div>
  );
}
