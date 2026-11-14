import CalendarButtons from "@/components/CalendarButtons";
import SkyWeek from "@/components/SkyWeek";
import { weekDates } from "@/components/time";
import {
  demoOpportunities,
  demoPlan,
  demoRecommendations,
  demoStudent,
  demoWeekStart,
} from "@/mocks/demo";

function shortDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function WeekPage() {
  const dates = weekDates(demoWeekStart);
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Your week, {shortDate(dates[0])} to {Number(dates[6].slice(8))}
          </h1>
          <p className="mt-2 max-w-xl text-lg text-ink-soft">
            {demoPlan.length} picks fit around your classes. Select one to see why Sunny chose it.
          </p>
        </div>
        <CalendarButtons studentId={demoStudent.id} />
      </div>
      <SkyWeek
        dates={dates}
        classes={demoStudent.classes}
        plan={demoPlan}
        opportunities={demoOpportunities}
        recommendations={demoRecommendations}
      />
    </>
  );
}
