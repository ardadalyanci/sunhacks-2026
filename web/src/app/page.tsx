import Link from "next/link";
import Mascot from "@/components/Mascot";
import { PRODUCT } from "@/components/brand";

const PREVIEW = [
  { time: "8:47 am", text: "Leave for BYENG, 9 min walk", style: "bg-ink text-cloud" },
  { time: "9:00 am", text: "CSE 230", style: "bg-sky/70" },
  { time: "10:00 am", text: "Work on Lab 7, due tonight", style: "border-2 border-dashed border-sun bg-sun-soft" },
  { time: "1:12 pm", text: "Leave for LL, 14 min walk", style: "bg-ink text-cloud" },
  { time: "6:00 pm", text: "Robotics club build night", style: "border-2 border-dusk text-dusk" },
];

export default function Home() {
  return (
    <main className="sky-day flex min-h-svh flex-1 flex-col px-4 py-6">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
        <Mascot size={44} />
        <span className="font-display text-2xl font-bold tracking-tight">{PRODUCT}</span>
      </div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 py-12 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
            ASU Mobile shows you information. {PRODUCT} plans your day.
          </h1>
          <p className="mt-6 max-w-xl text-xl leading-relaxed">
            Your classes, Canvas due dates, the Tempe heat and the club events you would actually go to, in one
            plan you can talk to.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/setup"
              className="rounded-full bg-ink px-6 py-4 text-lg font-bold text-cloud hover:bg-ink/90"
            >
              Plan my day
            </Link>
            <Link
              href="/today"
              className="rounded-full border-2 border-ink bg-cloud/40 px-6 py-4 text-lg font-bold hover:bg-cloud/70"
            >
              See a sample day
            </Link>
          </div>
        </div>

        <figure
          aria-label={`A sample ${PRODUCT} plan`}
          className="rounded-[2rem] bg-cloud/90 p-5 shadow-[0_30px_80px_-30px_rgba(20,50,74,0.5)] sm:p-6"
        >
          <div className="flex items-start gap-3">
            <Mascot size={68} className="shrink-0" />
            <p className="rounded-2xl rounded-tl-sm bg-sun-soft p-3 leading-snug">
              “Lab 7 is due tonight, so I saved 90 minutes after CSE 230. Leave Wexler at 1:12 to make ENG 102.”
            </p>
          </div>
          <ol className="mt-5 space-y-2">
            {PREVIEW.map((row) => (
              <li key={row.time} className={`flex items-baseline gap-3 rounded-2xl px-3 py-2 ${row.style}`}>
                <span className="w-16 shrink-0 text-sm font-bold">{row.time}</span>
                <span className="font-bold">{row.text}</span>
              </li>
            ))}
          </ol>
          <figcaption className="mt-4 text-sm text-ink-soft">
            Ask it out loud: “How’s my day?” or “Add the robotics meeting.”
          </figcaption>
        </figure>
      </div>

      <p className="mx-auto w-full max-w-6xl text-sm text-cloud/80">Built at sunhacks 2026, Tempe</p>
    </main>
  );
}
