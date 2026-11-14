"use client";

import { useMemo, useState } from "react";
import type { ClassBlock, Layer, Opportunity, PlanItem, Recommendation } from "@/mocks/legacy-types";
import SunnyMark from "./SunnyMark";
import { WEEKDAYS, formatDay, formatRange, formatTime, hhmmToHours, parseLocal } from "./time";

const START = 8; // 8 am
const END = 22; // 10 pm
const ROW = 48; // px per hour

const LAYER: Record<Layer, { border: string; text: string; label: string }> = {
  career: { border: "border-saguaro", text: "text-saguaro", label: "Career" },
  social: { border: "border-dusk", text: "text-dusk", label: "Social" },
};

type ClassCell = {
  kind: "class";
  key: string;
  day: number;
  start: number;
  end: number;
  course: string;
  location?: string;
};

type PickCell = {
  kind: "pick";
  key: string;
  day: number;
  start: number;
  end: number;
  item: PlanItem;
  opp: Opportunity;
  rec?: Recommendation;
};

type Cell = ClassCell | PickCell;

type Props = {
  dates: string[]; // 7 ISO dates, Monday first
  classes: ClassBlock[];
  plan: PlanItem[];
  opportunities: Opportunity[];
  recommendations: Recommendation[];
};

export default function SkyWeek({ dates, classes, plan, opportunities, recommendations }: Props) {
  const [items, setItems] = useState(plan);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const cells = useMemo<Cell[]>(() => {
    const out: Cell[] = [];
    for (const c of classes) {
      for (const d of c.days) {
        out.push({
          kind: "class",
          key: `${c.course}-${d}`,
          day: WEEKDAYS.indexOf(d),
          start: hhmmToHours(c.start),
          end: hhmmToHours(c.end),
          course: c.course,
          location: c.location,
        });
      }
    }
    for (const item of items) {
      const opp = opportunities.find((o) => o.id === item.opportunityId);
      if (!opp) continue;
      const s = parseLocal(item.startsAt);
      out.push({
        kind: "pick",
        key: item.opportunityId,
        day: s.dayIndex,
        start: s.hours,
        end: parseLocal(item.endsAt).hours,
        item,
        opp,
        rec: recommendations.find((r) => r.opportunityId === item.opportunityId),
      });
    }
    return out;
  }, [classes, items, opportunities, recommendations]);

  const selected = cells.find((c) => c.key === selectedKey) ?? null;
  const hours = Array.from({ length: END - START }, (_, i) => START + i);

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.opportunityId !== id));
    setSelectedKey(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <div className="overflow-x-auto rounded-3xl border border-ink/15 bg-cloud">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-ink/10">
              <div />
              {dates.map((date, i) => (
                <div key={date} className="px-2 py-3 text-center">
                  <span className="block text-sm text-ink-soft">{WEEKDAYS[i]}</span>
                  <span className="font-display text-2xl font-bold">{Number(date.slice(8))}</span>
                </div>
              ))}
            </div>

            <div
              className="sky-day relative grid grid-cols-[56px_repeat(7,1fr)]"
              style={{ height: (END - START) * ROW }}
            >
              <div className="relative" aria-hidden>
                {hours.slice(1).map((h) => (
                  <span
                    key={h}
                    className={`absolute right-2 -translate-y-1/2 text-xs ${
                      h >= 19 ? "text-cloud/80" : "text-ink-soft"
                    }`}
                    style={{ top: (h - START) * ROW }}
                  >
                    {formatTime(h)}
                  </span>
                ))}
              </div>

              {dates.map((date, day) => (
                <div key={date} className="relative border-l border-ink/10">
                  {hours.slice(1).map((h) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-ink/5"
                      style={{ top: (h - START) * ROW }}
                    />
                  ))}
                  {cells
                    .filter((c) => c.day === day)
                    .map((c) => {
                      const top = (Math.max(c.start, START) - START) * ROW;
                      const height = (Math.min(c.end, END) - Math.max(c.start, START)) * ROW;
                      const isSelected = selectedKey === c.key;
                      if (c.kind === "class") {
                        return (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => setSelectedKey(c.key)}
                            aria-pressed={isSelected}
                            className={`absolute inset-x-1 overflow-hidden rounded-lg border border-ink/20 bg-cloud/60 px-2 py-1 text-left text-xs text-ink ${
                              isSelected ? "ring-2 ring-ink" : ""
                            }`}
                            style={{ top, height }}
                          >
                            <span className="block font-bold">{c.course}</span>
                          </button>
                        );
                      }
                      const layer = LAYER[c.item.layer];
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => setSelectedKey(c.key)}
                          aria-pressed={isSelected}
                          className={`absolute inset-x-1 overflow-hidden rounded-xl border-2 bg-cloud px-2 py-1 text-left text-xs ${
                            layer.border
                          } ${
                            isSelected
                              ? "shadow-[0_0_0_5px_var(--sun)]"
                              : "shadow-[0_0_0_4px_rgba(255,176,0,0.35)]"
                          }`}
                          style={{ top, height }}
                        >
                          <span
                            className={`font-bold leading-tight ${height < 60 ? "line-clamp-2" : "line-clamp-3"} ${layer.text}`}
                          >
                            {c.opp.title}
                          </span>
                          {height >= 60 && (
                            <span className="block text-ink-soft">{formatTime(c.start)}</span>
                          )}
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft" aria-label="Legend">
          <li className="flex items-center gap-2">
            <span className="h-3 w-5 rounded border-2 border-saguaro bg-cloud" /> Career pick
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-5 rounded border-2 border-dusk bg-cloud" /> Social pick
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-5 rounded border border-ink/30 bg-cloud/60" /> Class
          </li>
        </ul>
      </div>

      <aside
        aria-live="polite"
        className="rounded-3xl border border-ink/15 bg-cloud p-5 lg:sticky lg:top-24 lg:self-start"
      >
        {!selected && (
          <div>
            <SunnyMark size={48} />
            <h2 className="mt-3 font-display text-2xl font-bold leading-tight">
              Select anything on your week
            </h2>
            <p className="mt-2 text-ink-soft">
              Sunny tells you why each pick fits your goals. Your classes stay where they are.
            </p>
          </div>
        )}

        {selected?.kind === "class" && (
          <div>
            <p className="font-bold text-ink-soft">From your class schedule</p>
            <h2 className="mt-1 font-display text-3xl font-bold">{selected.course}</h2>
            <p className="mt-2">
              {formatTime(selected.start)} to {formatTime(selected.end)}
              {selected.location ? `, ${selected.location}` : ""}
            </p>
          </div>
        )}

        {selected?.kind === "pick" && (
          <div>
            <p className={`font-bold ${LAYER[selected.item.layer].text}`}>
              {LAYER[selected.item.layer].label}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{selected.opp.title}</h2>
            <p className="mt-2 text-ink-soft">
              {formatDay(parseLocal(selected.item.startsAt).date)},{" "}
              {formatRange(selected.item.startsAt, selected.item.endsAt)}
            </p>
            <p className="text-ink-soft">
              {selected.opp.organizer}
              {selected.opp.location ? `, ${selected.opp.location}` : ""}
            </p>
            {selected.rec && (
              <p className="mt-4 rounded-2xl bg-sun-soft p-4 leading-relaxed">
                <strong>Why Sunny picked it: </strong>
                {selected.rec.why}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={selected.opp.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-ink px-4 py-2 font-bold text-cloud hover:bg-ink/90"
              >
                Open event page
              </a>
              <button
                type="button"
                onClick={() => remove(selected.opp.id)}
                className="rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10"
              >
                Remove from my week
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
