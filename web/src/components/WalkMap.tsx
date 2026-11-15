"use client";

import { useId } from "react";
import type { DayItem } from "@/lib/types";
import { walkLink } from "@/lib/places";
import { formatTime, parseLocal } from "./time";
import {
  fitBounds,
  legCurve,
  markers,
  placeLabels,
  project,
  tilesFor,
  walkLegs,
  walkSummary,
  type Box,
} from "./walk-map";

type Props = {
  date: string; // the plan's day ("2026-11-14")
  items: DayItem[];
  startBuildingId?: string; // where the day starts (a building id), when the student set one
  hot: boolean;
  nextItemId: string | null; // the class or event the next walk goes to
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const SIZE = { width: 340, height: 250 };
const GOLD = "#FFC627";
const HEAT = "#F97316";
const INK = "#14324a";
const PILL_H = 18;
const clock = (iso: string) => formatTime(parseLocal(iso).hours);

/** The day's walks on a map, with the minutes for each leg. */
export default function WalkMap({ date, items, startBuildingId, hot, nextItemId, selectedId, onSelect }: Props) {
  const id = useId();
  const { stops, legs } = walkLegs(items, date, startBuildingId);
  if (legs.length === 0) return null;

  const bounds = fitBounds(stops);
  const at = (place: { lat: number; lng: number }) => project(place.lat, place.lng, bounds, SIZE);
  const { z, tiles } = tilesFor(bounds, SIZE);

  // Walks to anything that starts before the next walk's stop are behind you; with no next walk, the day's
  // walking is done.
  const nextItem = items.find((i) => i.id === nextItemId);
  const cutoff = nextItem ? Date.parse(nextItem.start) : nextItemId ? -Infinity : Infinity;
  const drawn = legs.map((leg) => {
    const curve = legCurve(at(leg.from), at(leg.to));
    const text = `${leg.minutes} min`;
    const pillW = text.length * 6.4 + 10;
    const pill: Box = { x: curve.mid.x - pillW / 2, y: curve.mid.y - PILL_H / 2, width: pillW, height: PILL_H };
    return {
      leg,
      curve,
      text,
      pill,
      isNext: leg.itemId === nextItemId,
      walked: Date.parse(leg.start) < cutoff,
      selected: leg.itemId === selectedId,
    };
  });

  const dots = markers(stops).map((m) => {
    const text = m.numbers.join(", ");
    // Where the day starts (the dorm) is a white dot, so it reads as home rather than a class.
    const home = m.numbers[0] === 1 && stops[0].itemIds.length === 0;
    return { ...m, at: at(m.place), text, home, radius: 11, width: Math.max(22, text.length * 7 + 10) };
  });
  const labels = placeLabels(
    dots.map((d) => ({ at: d.at, radius: Math.max(d.radius, d.width / 2), text: d.place.word })),
    drawn.map((d) => d.pill),
    SIZE,
  );
  // Draw walked legs first and the next walk last, so the walk that matters sits on top.
  const order = [...drawn].sort((a, b) => Number(a.isNext) - Number(b.isNext) || Number(b.walked) - Number(a.walked));
  const legColor = hot ? HEAT : INK;
  const route = stops.map((s) => s.place.word).join(", then ");

  return (
    <section className="rounded-3xl bg-cloud p-5" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="font-display text-2xl font-bold">
        Your walks
      </h2>
      <p className="mt-1">{walkSummary(legs, hot)}</p>

      {/* Map and legs side by side from sm up (a wide card under the sky), stacked on a phone. */}
      <div className="mt-3 sm:grid sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] sm:items-start sm:gap-5">
        <div className="relative overflow-hidden rounded-2xl bg-[#e8efe4] ring-1 ring-ink/10">
          <svg
            viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
            className="block h-auto w-full"
            role="img"
            aria-label={`Map of your walks: ${route}.`}
          >
            {/* A faint grid stands in for the streets when the map tiles do not load (venue Wi-Fi). */}
            <defs>
              <pattern id={`${id}-grid`} width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M24 0H0V24" fill="none" stroke={INK} strokeOpacity="0.07" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={SIZE.width} height={SIZE.height} fill={`url(#${id}-grid)`} />
            <g style={{ filter: "saturate(0.55)" }}>
              {tiles.map((t) => (
                <image
                  key={`${z}/${t.x}/${t.y}`}
                  href={`https://tile.openstreetmap.org/${z}/${t.x}/${t.y}.png`}
                  x={t.left}
                  y={t.top}
                  width={t.size + 0.5}
                  height={t.size + 0.5}
                  preserveAspectRatio="none"
                />
              ))}
            </g>
            {/* A light wash over the tiles keeps the route the boldest thing on the map. */}
            <rect width={SIZE.width} height={SIZE.height} fill="#ffffff" fillOpacity="0.3" />

            {order.map(({ leg, curve, isNext, walked, selected }) => {
              const width = isNext ? 5 : walked ? 2.5 : 3.5;
              return (
                <g key={leg.itemId}>
                  {/* A white halo keeps the line readable over the tiles; the walk picked in the list gets a wide sun glow. */}
                  <path
                    d={curve.d}
                    fill="none"
                    stroke={selected ? "#FFE7B0" : "#ffffff"}
                    strokeOpacity={selected ? 1 : 0.9}
                    strokeWidth={width + (selected ? 12 : 4)}
                    strokeLinecap="round"
                  />
                  {isNext && <path d={curve.d} fill="none" stroke={INK} strokeWidth={width + 3} strokeLinecap="round" />}
                  <path
                    d={curve.d}
                    fill="none"
                    stroke={isNext ? GOLD : legColor}
                    strokeWidth={width}
                    strokeLinecap="round"
                    strokeDasharray={walked ? "1 6" : undefined}
                  />
                  <polygon
                    points="-5,-4.5 5,0 -5,4.5"
                    transform={`translate(${curve.arrow.x} ${curve.arrow.y}) rotate(${curve.arrow.angle})`}
                    fill={isNext ? GOLD : legColor}
                    stroke={isNext ? INK : "#ffffff"}
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {order.map(({ leg, text, pill, isNext }) => (
              <g key={`${leg.itemId}-minutes`}>
                <rect
                  x={pill.x}
                  y={pill.y}
                  width={pill.width}
                  height={pill.height}
                  rx={PILL_H / 2}
                  fill={isNext ? GOLD : "#ffffff"}
                  stroke={isNext ? INK : legColor}
                  strokeWidth="1.5"
                />
                <text x={pill.x + pill.width / 2} y={pill.y + pill.height / 2} textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill={INK}>
                  {text}
                </text>
              </g>
            ))}

            {dots.map((d) => (
              <g key={d.place.id}>
                <rect
                  x={d.at.x - d.width / 2}
                  y={d.at.y - d.radius}
                  width={d.width}
                  height={d.radius * 2}
                  rx={d.radius}
                  fill={d.home ? "#ffffff" : INK}
                  stroke={d.home ? INK : "#ffffff"}
                  strokeWidth="2"
                />
                <text
                  x={d.at.x}
                  y={d.at.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="12"
                  fontWeight="700"
                  fill={d.home ? INK : "#ffffff"}
                >
                  {d.text}
                </text>
              </g>
            ))}

            {dots.map((d, i) => (
              <text
                key={`${d.place.id}-label`}
                x={labels[i].x}
                y={labels[i].y}
                textAnchor={labels[i].anchor}
                dominantBaseline="central"
                fontSize="12"
                fontWeight="700"
                fill={INK}
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {d.place.word}
              </text>
            ))}
          </svg>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="absolute right-0 bottom-0 rounded-tl-lg bg-cloud/90 px-2 py-0.5 text-[11px] text-ink underline-offset-2 hover:underline"
          >
            © OpenStreetMap contributors
          </a>
        </div>

        <div>
          <ol className="mt-3 space-y-1 sm:mt-0">
            {drawn.map(({ leg, isNext, selected }) => (
              // The Directions link sits in the row's bottom corner (beside the short title line), so the walk's
              // minutes and leave time get the full width of a narrow card.
              <li key={leg.itemId} className={`relative rounded-2xl ${selected ? "bg-sun-soft" : ""}`}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(leg.itemId)}
                  className="flex min-h-10 w-full items-start gap-3 rounded-2xl px-2 py-2 text-left hover:bg-ink/5"
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isNext ? "bg-[#FFC627] text-ink ring-2 ring-ink" : "bg-ink text-cloud"
                    }`}
                  >
                    {leg.toNumber}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">
                      {leg.from.word} → {leg.to.word}
                    </span>
                    <span className="block leading-snug">
                      {leg.minutes} min · <span className="whitespace-nowrap">leave {clock(leg.leaveAt)}</span>
                    </span>
                    <span className="block min-h-6 pr-24 text-sm text-ink-soft">
                      {isNext && <span className="font-bold text-ink">Next walk · </span>}
                      {leg.title}
                    </span>
                  </span>
                </button>
                <a
                  href={walkLink(leg.location ?? leg.to.id)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Directions to ${leg.to.word} (opens in a new tab)`}
                  className="absolute right-1 bottom-0.5 flex min-h-10 items-center rounded-full px-3 text-sm font-bold underline underline-offset-4 hover:bg-ink/10"
                >
                  Directions
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-3 px-2 text-sm text-ink-soft">Walking time is estimated from the distance between buildings.</p>
        </div>
      </div>
    </section>
  );
}

