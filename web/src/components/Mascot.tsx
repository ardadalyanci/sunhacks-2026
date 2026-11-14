import { MASCOT, PRODUCT } from "./brand";

// The mascot: a sun with pilot goggles and a scarf. Teammate C can replace this with final art.
type Props = {
  size?: number;
  className?: string;
  label?: string;
  hot?: boolean; // sweating, for heat alerts
};

export default function Mascot({ size = 40, className, label = `${MASCOT}, the ${PRODUCT} mascot`, hot = false }: Props) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  const sun = hot ? "#ff8a3d" : "var(--sun)";
  const decorative = label === "";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      className={className}
    >
      <g stroke={sun} strokeWidth="7" strokeLinecap="round">
        {rays.map((deg) => (
          <line key={deg} x1="60" y1="8" x2="60" y2="20" transform={`rotate(${deg} 60 62)`} />
        ))}
      </g>
      <circle cx="60" cy="62" r="31" fill={sun} />

      {/* goggles pushed up on the forehead */}
      <path d="M29 50 Q60 40 91 50" stroke="var(--ink)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="47" cy="47" r="10" fill="#bfe3ff" stroke="var(--ink)" strokeWidth="4" />
      <circle cx="73" cy="47" r="10" fill="#bfe3ff" stroke="var(--ink)" strokeWidth="4" />
      <path d="M43 44 l5 -3" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <path d="M69 44 l5 -3" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />

      <circle cx="50" cy="66" r="3.8" fill="var(--ink)" />
      <circle cx="70" cy="66" r="3.8" fill="var(--ink)" />
      <path d="M49 75 Q60 84 71 75" stroke="var(--ink)" strokeWidth="4" fill="none" strokeLinecap="round" />

      {/* scarf */}
      <path d="M35 86 Q60 99 85 86 L87 94 Q60 107 33 94 Z" fill="var(--dusk)" />
      <path d="M81 91 L105 98 L99 106 L78 98 Z" fill="var(--dusk)" />

      {hot && <path d="M90 55 q5 8 0 12 q-5 -4 0 -12 Z" fill="#7cc4ff" stroke="var(--ink)" strokeWidth="1.5" />}
    </svg>
  );
}
