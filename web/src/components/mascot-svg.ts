// Sol as a plain SVG string with fixed colors, for generated images (app icons) where CSS variables
// and React components are not available. Keep it in step with components/Mascot.tsx (happy mood).
export function mascotSvg(): string {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30)
    .map((deg) => `<line x1="60" y1="8" x2="60" y2="20" transform="rotate(${deg} 60 62)"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<g stroke="#ffb000" stroke-width="7" stroke-linecap="round">${rays}</g>
<circle cx="60" cy="62" r="31" fill="#ffb000"/>
<circle cx="41" cy="75" r="4.5" fill="#ff7f7f" opacity="0.55"/>
<circle cx="79" cy="75" r="4.5" fill="#ff7f7f" opacity="0.55"/>
<path d="M29 50 Q60 40 91 50" stroke="#14324a" stroke-width="5" fill="none" stroke-linecap="round"/>
<circle cx="47" cy="47" r="10" fill="#bfe3ff" stroke="#14324a" stroke-width="4"/>
<circle cx="73" cy="47" r="10" fill="#bfe3ff" stroke="#14324a" stroke-width="4"/>
<path d="M43 44 l5 -3" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
<path d="M69 44 l5 -3" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
<circle cx="50" cy="66" r="3.8" fill="#14324a"/>
<circle cx="70" cy="66" r="3.8" fill="#14324a"/>
<path d="M49 75 Q60 84 71 75" stroke="#14324a" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M35 86 Q60 99 85 86 L87 94 Q60 107 33 94 Z" fill="#5b3fa8"/>
<path d="M81 91 L105 98 L99 106 L78 98 Z" fill="#5b3fa8"/>
</svg>`;
}

export function mascotDataUri(): string {
  return `data:image/svg+xml;base64,${Buffer.from(mascotSvg()).toString("base64")}`;
}
