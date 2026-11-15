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
      <ul className="flex w-max gap-2">
        {days.map((day, index) => {
          const chosen = day === date;
          return (
            <li key={day}>
              <a
                href={index === 0 ? "#today" : `#${day}`}
                aria-current={chosen ? "true" : undefined}
                className={`block whitespace-nowrap rounded-full border-2 px-4 py-2 font-bold ${
                  chosen ? "border-ink bg-ink text-cloud" : "border-ink/20 bg-cloud hover:border-ink"
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
