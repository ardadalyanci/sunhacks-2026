"use client";

import type { ReactNode } from "react";
import { MASCOT } from "./brand";
import Mascot from "./Mascot";
import type { useDay } from "./useDay";
import { useNow } from "./useNow";
import { baseNow, canOversleep } from "./what-if";

type Props = {
  day: ReturnType<typeof useDay>;
};

type PillProps = {
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
  onClass: string; // the fill while the pill is on
  label: string; // the whole question, for screen readers ("What if I oversleep?")
  children: ReactNode;
};

/** "What if " on wider screens; phones show it once before the pills, so three pills fit in two rows. */
const WhatIf = () => <span className="hidden sm:inline">What if </span>;

/** One on/off "What if…" pill. A check mark shows it is on, so the state never rests on color alone. */
function Pill({ on, disabled, onToggle, onClass, label, children }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-2 text-left text-[15px] font-semibold leading-tight disabled:opacity-50 ${
        on ? onClass : "border-line bg-surface hover:border-ink/40"
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
  const { whatIf, busy, skip, skipKey, change, plan, request } = day;
  const clockNow = useNow();
  // Oversleeping only makes sense in the morning, before the first walk. The plan's own clock decides: the sample
  // replays 8 am, a real today uses the clock. A pill that is on always stays, so it can be turned off.
  const oversleep = whatIf.overslept || !plan || !request || canOversleep(plan, baseNow(request, clockNow));
  const replanning = busy && !day.switching; // a pill, "+ Add" or a voice action is being planned
  return (
    <div className="mt-3">
      <div role="group" aria-label="What if…" className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="text-sm font-semibold text-ink-soft sm:hidden">
          What if…
        </span>
        <Pill
          on={whatIf.hot}
          disabled={busy}
          onToggle={() => void day.setWhatIf({ hot: !whatIf.hot })}
          onClass="border-[#F97316] bg-[#F97316] text-ink"
          label="What if it’s 104°?"
        >
          <WhatIf />
          it’s 104°?
        </Pill>
        {oversleep && (
          <Pill
            on={whatIf.overslept}
            disabled={busy}
            onToggle={() => void day.setWhatIf({ overslept: !whatIf.overslept })}
            onClass="border-ink bg-ink text-cloud"
            label="What if I oversleep?"
          >
            <WhatIf />I oversleep?
          </Pill>
        )}
        {skip && skipKey && (
          <Pill
            on={whatIf.skipped !== null}
            disabled={busy}
            onToggle={() => void day.setWhatIf({ skipped: whatIf.skipped ? null : skipKey })}
            onClass="border-ink bg-ink text-cloud"
            label={`What if ${skip} is cancelled?`}
          >
            <WhatIf />
            {skip} is cancelled?
          </Pill>
        )}
      </div>
      {/* Always in the page, so screen readers hear each new note as it arrives. While Sol re-plans, his note
          gives way to a line saying so; the old note stays invisible underneath, so the page does not jump. */}
      <div aria-live="polite">
        {(change || replanning) && (
          <div className="mt-3 grid max-w-prose">
            {change && (
              <p
                aria-hidden={replanning || undefined}
                className={`flex items-start gap-3 rounded-xl border border-sun/40 bg-sun-soft/60 px-4 py-3 [grid-area:1/1] ${replanning ? "invisible" : ""}`}
              >
                <Mascot size={26} label="" className="mt-0.5 shrink-0" />
                <span>{change}</span>
              </p>
            )}
            {replanning && (
              <p className="flex items-start gap-3 rounded-xl border border-sun/40 bg-sun-soft/60 px-4 py-3 [grid-area:1/1]">
                <Mascot size={26} label="" className="mt-0.5 shrink-0" />
                <span className="motion-safe:animate-pulse">{MASCOT} is re-planning your day…</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
