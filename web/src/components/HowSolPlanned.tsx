import type { DayPlan, PlanRequest } from "@/lib/types";

type Props = {
  plan: DayPlan;
  request: PlanRequest | null; // what was sent to /api/plan; null while the day loads
  isDemo: boolean; // the sample student, not a real setup
  later: boolean; // a look-ahead at a coming day
};

/** How this exact day was put together, step by step, with the real numbers. */
export default function HowSolPlanned(_props: Props) {
  return null;
}
