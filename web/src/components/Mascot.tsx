import { MASCOT, PRODUCT } from "./brand";

// The mascot: a sun with pilot goggles and a scarf, with a few moods. Teammate C can refine the art.
export type Mood = "happy" | "listening" | "hot" | "proud";

type Props = {
  size?: number;
  className?: string;
  label?: string; // "" makes it decorative
  mood?: Mood;
  animated?: boolean; // gentle float and blink; off when the viewer prefers reduced motion
};

export default function Mascot({
  size = 40,
  className = "",
  label = `${MASCOT}, the ${PRODUCT} mascot`,
  mood = "happy",
  animated = false,
}: Props) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  const sun = mood === "hot" ? "#ff8a3d" : "var(--sun)";
  const decorative = label === "";
  const lookUp = mood === "listening" ? -3 : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      className={`${animated ? "mascot-float" : ""} ${className}`}
    >
      <g stroke={sun} strokeWidth="7" strokeLinecap="round">
        {rays.map((deg) => (
          <line key={deg} x1="60" y1="8" x2="60" y2="20" transform={`rotate(${deg} 60 62)`} />
        ))}
      </g>
      <circle cx="60" cy="62" r="31" fill={sun} />
      <circle cx="41" cy="75" r="4.5" fill="#ff7f7f" opacity="0.55" />
      <circle cx="79" cy="75" r="4.5" fill="#ff7f7f" opacity="0.55" />

      {/* goggles pushed up on the forehead */}
      <path d="M29 50 Q60 40 91 50" stroke="var(--ink)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="47" cy="47" r="10" fill="#bfe3ff" stroke="var(--ink)" strokeWidth="4" />
      <circle cx="73" cy="47" r="10" fill="#bfe3ff" stroke="var(--ink)" strokeWidth="4" />
      <path d="M43 44 l5 -3" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <path d="M69 44 l5 -3" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />

      {mood === "proud" ? (
        <g stroke="var(--ink)" strokeWidth="4" fill="none" strokeLinecap="round">
          <path d="M45 68 Q50 62 55 68" />
          <path d="M65 68 Q70 62 75 68" />
        </g>
      ) : mood === "hot" ? (
        <g stroke="var(--ink)" strokeWidth="4" strokeLinecap="round">
          <path d="M46 66 L54 66" />
          <path d="M66 66 L74 66" />
        </g>
      ) : (
        <g className={animated ? "mascot-blink" : undefined}>
          <circle cx="50" cy={66 + lookUp} r="3.8" fill="var(--ink)" />
          <circle cx="70" cy={66 + lookUp} r="3.8" fill="var(--ink)" />
        </g>
      )}

      {mood === "listening" && <ellipse cx="60" cy="78" rx="3.5" ry="4.5" fill="var(--ink)" />}
      {mood === "hot" && (
        <path
          d="M47 79 q3.25 -4 6.5 0 q3.25 4 6.5 0 q3.25 -4 6.5 0 q3.25 4 6.5 0"
          stroke="var(--ink)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {mood === "proud" && <path d="M47 74 Q60 91 73 74 Z" fill="var(--ink)" />}
      {mood === "happy" && (
        <path d="M49 75 Q60 84 71 75" stroke="var(--ink)" strokeWidth="4" fill="none" strokeLinecap="round" />
      )}

      {/* scarf */}
      <path d="M35 86 Q60 99 85 86 L87 94 Q60 107 33 94 Z" fill="var(--dusk)" />
      <path d="M81 91 L105 98 L99 106 L78 98 Z" fill="var(--dusk)" />

      {mood === "hot" && (
        <path d="M90 55 q5 8 0 12 q-5 -4 0 -12 Z" fill="#7cc4ff" stroke="var(--ink)" strokeWidth="1.5" />
      )}
    </svg>
  );
}
