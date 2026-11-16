import Link from "next/link";
import Mascot from "@/components/Mascot";
import { MASCOT, PRODUCT } from "@/components/brand";

const DAY = [
  {
    time: "10:13 am",
    text: "Leave for Brickyard 210",
    note: "A 17-minute walk from Manzanita, timed so you’re in your seat before CSE 230 starts.",
    style: "bg-ink text-cloud",
  },
  {
    time: "11:30 am",
    text: "Work on Lab 7",
    note: "Due on Canvas at 11:59 tonight, so Sol saves your gap between classes for it.",
    style: "border border-dashed border-sun bg-sun-soft",
  },
  {
    time: "1:19 pm",
    text: "Leave for Coor Hall 170",
    note: "On a 104° day, Sol has you leave a few minutes early and reminds you to fill your bottle.",
    style: "bg-[#ff8a3d]",
  },
  {
    time: "4:15 pm",
    text: "Robotics club build night",
    note: "From Sun Devil Central, because you picked robotics.",
    style: "border border-dusk/40 bg-surface text-dusk",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="sky-day flex min-h-svh flex-col px-4 py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
          <Mascot size={36} label="" />
          <span className="font-display text-xl font-bold tracking-tight">{PRODUCT}</span>
        </div>

        <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="font-display text-[2.75rem] font-bold leading-[1.04] tracking-tight sm:text-6xl lg:text-[4.25rem]">
              ASU Mobile shows your schedule. {PRODUCT} plans your day.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/85 sm:text-xl">
              It reads your Canvas and your class times, checks how hot Tempe is, and finds the club nights you’d
              actually go to. Then it tells you when to walk out the door.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/setup"
                className="inline-flex min-h-12 items-center rounded-xl bg-ink px-6 text-[17px] font-semibold text-cloud shadow-[0_10px_30px_-12px_rgba(20,50,74,0.6)] hover:bg-ink/90"
              >
                Plan my day
              </Link>
              <Link
                href="/today"
                className="inline-flex min-h-12 items-center rounded-xl border border-ink/25 bg-surface/70 px-6 text-[17px] font-semibold backdrop-blur hover:bg-surface"
              >
                See a sample day
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <p className="relative max-w-sm rounded-2xl bg-surface px-6 py-5 text-[17px] font-semibold leading-snug shadow-[0_24px_60px_-28px_rgba(20,50,74,0.55)]">
              “Lab 7’s due tonight, so I blocked 11:30 for it. Leave for Coor Hall at 1:19.”
              <span aria-hidden className="absolute -bottom-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 bg-cloud" />
            </p>
            <Mascot size={250} animated className="mt-6 max-w-full" />
            <p className="mt-1 font-display text-lg font-bold">{MASCOT}, your day pilot</p>
          </div>
        </div>

        <p className="mx-auto w-full max-w-6xl text-sm text-cloud/80">sundial.club, made in Tempe at sunhacks 9.0</p>
      </section>

      <section className="border-t border-line bg-page px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-[2.75rem] sm:leading-tight">
            One day, planned by {MASCOT}
          </h2>
          <p className="mt-3 max-w-xl text-lg text-ink-soft">
            {MASCOT} works out the walk between buildings, the gaps between classes, and how much the heat will slow
            you down.
          </p>
          <ol className="mt-10 max-w-3xl border-l-2 border-line pl-6">
            {DAY.map((step) => (
              <li key={step.time} className="relative pb-10 last:pb-0">
                <span aria-hidden className="absolute -left-[32px] top-1.5 h-3.5 w-3.5 rounded-full border-[3px] border-page bg-ink" />
                <p className="text-sm font-semibold text-ink-soft">{step.time}</p>
                <p className={`mt-1.5 inline-block rounded-lg px-3.5 py-2 font-semibold ${step.style}`}>{step.text}</p>
                <p className="mt-2 max-w-prose text-[17px] leading-relaxed text-ink/85">{step.note}</p>
              </li>
            ))}
          </ol>
          <p className="mt-12 max-w-3xl rounded-2xl border border-line bg-surface px-6 py-5 text-lg leading-relaxed">
            Ask out loud: “When should I leave?” or “Add the robotics meeting.” Then press Play and watch {MASCOT} ride
            your day across the sky.
          </p>
        </div>
      </section>

      <section className="bg-ink px-4 py-16 text-cloud">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold">Set up in two minutes</h2>
            <p className="mt-2 max-w-xl text-lg text-cloud/85">
              Snap a photo of your class schedule, paste your Canvas token and pick what you enjoy.
            </p>
            <p className="mt-2 text-cloud/70">
              Works with Canvas, ASU Events, Sun Devil Central and Open-Meteo. Never asks for your ASU password.
            </p>
          </div>
          <Link href="/setup" className="inline-flex min-h-12 shrink-0 items-center rounded-xl bg-sun px-6 text-[17px] font-semibold text-ink hover:bg-sun/90">
            Plan my day
          </Link>
        </div>
      </section>
    </main>
  );
}
