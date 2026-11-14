import Link from "next/link";
import SunnyMark from "@/components/SunnyMark";

export default function Home() {
  return (
    <main className="sky-day flex min-h-svh flex-1 flex-col justify-between px-4 py-6">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
        <SunnyMark size={40} />
        <span className="font-display text-2xl font-bold tracking-tight">Sunny</span>
      </div>

      <div className="mx-auto w-full max-w-6xl py-12">
        <h1 className="max-w-4xl font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
          Your week at ASU, planned around where you want to be in May.
        </h1>
        <p className="mt-6 max-w-xl text-xl leading-relaxed">
          Sunny reads your classes and your goals, finds the club events, career fairs and internships
          worth your time, and puts them on your calendar.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/onboarding"
            className="rounded-full bg-ink px-6 py-4 text-lg font-bold text-cloud hover:bg-ink/90"
          >
            Plan my week
          </Link>
          <Link
            href="/week"
            className="rounded-full border-2 border-ink bg-cloud/40 px-6 py-4 text-lg font-bold hover:bg-cloud/70"
          >
            See a sample week
          </Link>
        </div>
      </div>

      <p className="mx-auto w-full max-w-6xl text-sm text-cloud/80">Built at sunhacks 2026, Tempe</p>
    </main>
  );
}
