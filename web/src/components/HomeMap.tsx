"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import type { Point } from "@/lib/commute";
import { boundsAround, project, tilesFor, unproject } from "./walk-map";

type Props = {
  home: Point;
  onMove: (p: Point) => void;
};

const SIZE = { width: 340, height: 220 };
const HALF_SPAN_M = 450; // a few blocks each way: close enough to tap your own building
const NUDGE_M = 30; // one arrow-key press
const INK = "#14324a";
const GOLD = "#FFC627";

/**
 * The student's home on a street map, centered on the pin. A tap (or the arrow keys) moves the pin, so a search
 * result that landed on the wrong side of the complex is easy to fix.
 */
export default function HomeMap({ home, onMove }: Props) {
  const bounds = boundsAround(home.lat, home.lng, HALF_SPAN_M);
  const { z, tiles } = tilesFor(bounds, SIZE);
  const pin = project(home.lat, home.lng, bounds, SIZE);

  function tap(event: MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    // The SVG scales with the card: turn the tap into map units first.
    const x = ((event.clientX - box.left) / box.width) * SIZE.width;
    const y = ((event.clientY - box.top) / box.height) * SIZE.height;
    onMove(unproject({ x, y }, bounds, SIZE));
  }

  function nudge(event: KeyboardEvent<SVGSVGElement>) {
    const step = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
    if (!step) return;
    event.preventDefault();
    const dLat = (step[0] * NUDGE_M) / 111_320;
    const dLng = (step[1] * NUDGE_M) / (111_320 * Math.cos((home.lat * Math.PI) / 180));
    onMove({ lat: home.lat + dLat, lng: home.lng + dLng });
  }

  return (
    <figure className="mt-4">
      <div className="overflow-hidden rounded-2xl bg-[#e8efe4] ring-1 ring-ink/15">
        <svg
          viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
          className="block h-auto w-full cursor-crosshair touch-manipulation focus:outline-none focus-visible:ring-4 focus-visible:ring-ink"
          role="img"
          aria-label="Map of your home. Tap the map, or use the arrow keys, to move the pin to your door."
          tabIndex={0}
          onClick={tap}
          onKeyDown={nudge}
        >
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
          {/* The pin: a sun-gold drop with an ink ring, its point on the spot. */}
          <g transform={`translate(${pin.x} ${pin.y})`}>
            <ellipse cx="0" cy="0" rx="7" ry="2.5" fill={INK} fillOpacity="0.25" />
            <path d="M0 0 C-4 -9 -12 -14 -12 -22 A12 12 0 1 1 12 -22 C12 -14 4 -9 0 0 Z" fill={GOLD} stroke={INK} strokeWidth="2.5" />
            <circle cx="0" cy="-22" r="4.5" fill={INK} />
          </g>
        </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap justify-between gap-x-4 text-sm text-ink-soft">
        <span>Tap the map to move the pin to your door.</span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          © OpenStreetMap contributors
        </a>
      </figcaption>
    </figure>
  );
}
