import { shortDay } from "./time";

type Props = {
  days: string[]; // today first, then the next six days
  date: string; // the day on screen
};

/** Today, Tomorrow and the next five days as links, so the chosen day is part of the URL. */
export default function DayPicker({ days, date }: Props) {
  if (days.length === 0) return null;
  return (
    <nav aria-label="Pick a day" className="-mx-4 mt-4 overflow-x-auto px-4 pb-1">
      <ul className="flex w-max gap-1 rounded-xl border border-line bg-surface p-1">
        {days.map((day, index) => {
          const chosen = day === date;
          return (
            <li key={day}>
              <a
                href={index === 0 ? "#today" : `#${day}`}
                aria-current={chosen ? "true" : undefined}
                className={`flex min-h-10 items-center whitespace-nowrap rounded-lg px-3.5 text-[15px] font-semibold ${
                  chosen ? "bg-ink text-cloud" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {index === 0 ? "Today" : index === 1 ? "Tomorrow" : shortDay(day)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
