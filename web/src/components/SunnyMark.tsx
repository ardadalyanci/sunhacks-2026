// Placeholder Sunny mascot. Teammate C replaces this with the final art in web/public/sunny/.
type Props = {
  size?: number;
  className?: string;
  label?: string;
  sleepy?: boolean;
};

export default function SunnyMark({ size = 40, className, label = "Sunny", sleepy = false }: Props) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  const sun = sleepy ? "#c9ced6" : "var(--sun)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      className={className}
    >
      <g stroke={sun} strokeWidth="6" strokeLinecap="round">
        {rays.map((deg) => (
          <line key={deg} x1="50" y1="6" x2="50" y2="17" transform={`rotate(${deg} 50 50)`} />
        ))}
      </g>
      <circle cx="50" cy="50" r="26" fill={sun} />
      {sleepy ? (
        <g stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" fill="none">
          <path d="M37 47 Q41 50 45 47" />
          <path d="M55 47 Q59 50 63 47" />
          <path d="M44 60 L56 60" />
        </g>
      ) : (
        <g>
          <circle cx="41" cy="46" r="3.5" fill="var(--ink)" />
          <circle cx="59" cy="46" r="3.5" fill="var(--ink)" />
          <path
            d="M40 57 Q50 66 60 57"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}
