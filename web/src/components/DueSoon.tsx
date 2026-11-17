import { MASCOT } from "./brand";
import { type Urgency, dueStatus, splitCourse } from "./due";
import { formatTime, parseLocal } from "./time";
import type { DayItem, TutoringHelp } from "@/lib/types";

const clock = (iso: string) => formatTime(parseLocal(iso).hours);

// The card's edge, tint and countdown colour by urgency. The words carry it too ("Overdue", "Due today at…").
const LOOK: Record<Urgency, { edge: string; card: string; left: string }> = {
  overdue: { edge: "bg-[#8C1D40]", card: "border-[#8C1D40]/35 bg-[#8C1D40]/[0.06]", left: "text-[#8C1D40]" },
  today: { edge: "bg-[#8C1D40]", card: "border-[#8C1D40]/35 bg-[#8C1D40]/[0.06]", left: "text-[#8C1D40]" },
  tomorrow: { edge: "bg-sun", card: "border-sun/60 bg-sun-soft/45", left: "text-ink" },
  later: { edge: "bg-ink/25", card: "border-line bg-surface", left: "text-ink" },
};

/**
 * The student's homework, right under the leave headline: one card per assignment not turned in, with a big
 * countdown, the time Sol saved for it on the sky and free tutoring that fits; turned-in work in one quiet line.
 */
export default function DueSoon({
  deadlines,
  items,
  help,
  nowMs,
  dueDay,
  today,
  tomorrow,
}: {
  deadlines: DayItem[]; // sorted by due time
  items: DayItem[];
  help?: TutoringHelp[];
  nowMs: number;
  dueDay: (date: string) => string; // "today", "tomorrow" or "Wednesday, Nov 18"
  today: string;
  tomorrow: string;
}) {
  const open = deadlines.filter((d) => !d.done);
  const done = deadlines.filter((d) => d.done);

  return (
    <section aria-labelledby="due-soon" className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="due-soon" className="font-display text-2xl font-bold">
          Due soon
        </h2>
        {deadlines.length > 0 && (
          <p className="text-[15px] font-semibold text-ink-soft">
            {open.length === 0 ? "All turned in" : `${open.length} not turned in yet`}
          </p>
        )}
      </div>
      {deadlines.length === 0 && (
        <p className="mt-1 text-ink-soft">Nothing due. Add your Canvas token in Setup to see assignments.</p>
      )}

      {open.length > 0 && (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {open.map((d) => {
            const { urgency, left } = dueStatus(d.start, nowMs, today, tomorrow);
            const look = LOOK[urgency];
            const { course, task } = splitCourse(d.title);
            const saved = items.filter((i) => i.type === "study_block" && i.title === `Work on: ${d.title}` && i.end);
            const tutoring = help?.find((h) => h.deadlineId === d.id);
            return (
              <li key={d.id} className={`relative overflow-hidden rounded-2xl border py-4 pr-4 pl-6 ${look.card}`}>
                <span aria-hidden className={`absolute inset-y-0 left-0 w-2 ${look.edge}`} />
                {course && <p className="text-[15px] font-bold text-ink-soft">{course}</p>}
                <p className="font-display text-xl font-bold leading-snug">{task}</p>
                {left && (
                  <p className={`mt-2 font-display text-[1.75rem] font-bold leading-none tracking-tight ${look.left}`}>{left}</p>
                )}
                <p className="mt-1.5 font-semibold">
                  Due {dueDay(parseLocal(d.start).date)} at {clock(d.start)}
                </p>
                {saved.length > 0 && (
                  <p className="mt-2 text-[15px] leading-snug">
                    {MASCOT} saved {saved.map((s) => `${clock(s.start)} to ${clock(s.end!)}`).join(" and ")} for it.
                  </p>
                )}
                {/* Free ASU drop-in tutoring that fits before the due time (lib/tutoring.ts). */}
                {tutoring && (
                  <p className="mt-2 text-sm leading-snug">
                    Free tutoring:{" "}
                    <a href={tutoring.url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                      {tutoring.center}
                    </a>
                    {tutoring.place ? `, ${tutoring.place}` : ""}.{" "}
                    <span className="text-ink-soft">
                      {tutoring.from && tutoring.to
                        ? `Usually open while you’re free, ${clock(tutoring.from)} to ${clock(tutoring.to)}.`
                        : "Hours vary by location."}
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 && (
        <p className="mt-3 text-[15px] text-ink-soft">
          <span className="font-bold text-saguaro">Turned in:</span> {done.map((d) => d.title).join(", ")}.
        </p>
      )}
    </section>
  );
}
