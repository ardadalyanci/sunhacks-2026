import Link from "next/link";
import type { FutureSnapshot } from "@/mocks/legacy-types";
import SunnyMark from "@/components/SunnyMark";
import { demoFutures, demoOpportunities } from "@/mocks/demo";

function Horizon({ snap, golden }: { snap: FutureSnapshot; golden: boolean }) {
  return (
    <section
      aria-label={snap.label}
      className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 ${golden ? "sky-golden" : "sky-overcast"}`}
    >
      <div aria-hidden className={`absolute -right-8 -top-8 ${golden ? "sunrise" : ""}`}>
        <SunnyMark size={150} sleepy={!golden} />
      </div>
      <p className="relative max-w-[60%] font-bold">{snap.label}</p>
      <h2 className="relative mt-3 max-w-md font-display text-3xl font-bold leading-tight">{snap.headline}</h2>

      <p className="relative mt-6 font-display text-xl">
        <span className="text-5xl font-bold">{snap.peopleMet}</span> people in your field know your name
      </p>

      <h3 className="relative mt-6 font-bold">Skills you can show</h3>
      <ul className="relative mt-2 flex flex-wrap gap-2">
        {snap.skills.map((s) => (
          <li key={s} className="rounded-full bg-cloud/70 px-3 py-1">
            {s}
          </li>
        ))}
      </ul>

      <h3 className="relative mt-6 font-bold">On your resume</h3>
      <ul className="relative mt-2 list-disc space-y-1 pl-5">
        {snap.resumeLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

export default function FuturesPage() {
  const picks = demoFutures.basedOn
    .map((id) => demoOpportunities.find((o) => o.id === id))
    .filter((o) => o !== undefined);

  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">May 2027, two ways</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-soft">
        Same classes, same you. The difference is what you do with the hours between them.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Horizon snap={demoFutures.asIs} golden={false} />
        <Horizon snap={demoFutures.withPlan} golden />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold">The picks that make the difference</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {picks.map((o) => (
            <li key={o.id} className="rounded-2xl border border-ink/15 bg-cloud p-4">
              <p className="font-bold">{o.title}</p>
              <p className="text-ink-soft">{o.organizer}</p>
            </li>
          ))}
        </ul>
        <Link
          href="/discover"
          className="mt-6 inline-block rounded-full bg-ink px-5 py-3 font-bold text-cloud hover:bg-ink/90"
        >
          See all picks
        </Link>
      </section>
    </>
  );
}
