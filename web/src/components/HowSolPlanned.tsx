import type { DayPlan, PlanRequest } from "@/lib/types";
import { MASCOT } from "./brand";
import { planFacts, planSources } from "./plan-facts";

type Props = {
  plan: DayPlan;
  request: PlanRequest | null; // what was sent to /api/plan; null while the day loads
  isDemo: boolean; // the sample student, not a real setup
  later: boolean; // a look-ahead at a coming day
};

/** How this exact day was put together, step by step, with the real numbers. */
export default function HowSolPlanned({ plan, request, isDemo, later }: Props) {
  if (!request) return null;
  const facts = planFacts(request, plan, { isDemo, later });
  const sources = planSources(plan);
  return (
    <details className="mt-8 rounded-3xl bg-cloud/70 p-5">
      <summary className="cursor-pointer py-2 font-display text-xl font-bold">How {MASCOT} planned this day</summary>
      <ol className="mt-3 max-w-prose list-decimal space-y-3 pl-6 leading-relaxed marker:font-bold">
        {facts.map((f) => (
          <li key={f.key} className="pl-1">
            <span className="font-bold">{f.label}.</span> {f.text}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-ink-soft">
        Sources:{" "}
        {sources.map((s, i) => (
          <span key={s.name}>
            {i > 0 && ", "}
            <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
              {s.name}
            </a>
          </span>
        ))}
      </p>
    </details>
  );
}
