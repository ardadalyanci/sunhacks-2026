"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import SunnyMark from "@/components/SunnyMark";

const INTERESTS = [
  "Soccer",
  "Hiking",
  "Gaming",
  "Music",
  "Volunteering",
  "Startups",
  "Robotics",
  "Art and design",
  "Meeting first-gen students",
  "Meeting international students",
];

const field = "mt-2 w-full rounded-2xl border-2 border-ink/20 bg-cloud px-4 py-3 focus:border-ink";

export default function OnboardingPage() {
  const router = useRouter();
  const [resume, setResume] = useState<File | null>(null);
  const [goal, setGoal] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [canvasUrl, setCanvasUrl] = useState("");
  const [schedule, setSchedule] = useState<File | null>(null);

  function toggleInterest(value: string) {
    setInterests((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    // TODO(B): send resume, goal, interests and schedule to the backend once A's APIs exist.
    router.push("/week");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/" className="flex items-center gap-2">
        <SunnyMark size={34} />
        <span className="font-display text-2xl font-bold tracking-tight">Sunny</span>
      </Link>

      <h1 className="mt-10 font-display text-5xl font-bold leading-tight tracking-tight">Let’s plan your week</h1>
      <p className="mt-3 text-lg text-ink-soft">Three steps, about two minutes.</p>

      <form onSubmit={submit} className="mt-10 space-y-10">
        <fieldset>
          <legend className="font-display text-2xl font-bold">1. Add your resume</legend>
          <p className="mt-1 text-ink-soft">Sunny uses it to see where you are today. A PDF works best.</p>
          <label className="mt-3 block">
            <span className="sr-only">Resume file</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setResume(e.target.files?.[0] ?? null)}
              className="block w-full rounded-2xl border-2 border-dashed border-ink/30 bg-cloud p-4 file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:font-bold file:text-cloud"
            />
          </label>
          {resume && <p className="mt-2 font-bold">Added {resume.name}</p>}
        </fieldset>

        <fieldset>
          <legend className="font-display text-2xl font-bold">2. Tell Sunny what you want</legend>
          <label className="mt-3 block">
            <span className="font-bold">Where do you want to be by May?</span>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="A software engineering internship for summer 2027"
              className={field}
            />
          </label>
          <p className="mt-5 font-bold">What do you like doing outside class?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTERESTS.map((value) => {
              const on = interests.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleInterest(value)}
                  className={`rounded-full border-2 px-4 py-2 font-bold ${
                    on ? "border-dusk bg-dusk text-cloud" : "border-ink/20 bg-cloud hover:border-ink"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-display text-2xl font-bold">3. Add your classes</legend>
          <p className="mt-1 text-ink-soft">
            Paste your Canvas calendar link, or upload a screenshot of your class schedule.
          </p>
          <label className="mt-3 block">
            <span className="font-bold">Canvas calendar link</span>
            <input
              type="url"
              value={canvasUrl}
              onChange={(e) => setCanvasUrl(e.target.value)}
              placeholder="https://canvas.asu.edu/feeds/calendars/..."
              className={field}
            />
          </label>
          <label className="mt-4 block">
            <span className="font-bold">Or a schedule screenshot</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSchedule(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full rounded-2xl border-2 border-dashed border-ink/30 bg-cloud p-4 file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:font-bold file:text-cloud"
            />
          </label>
          {schedule && <p className="mt-2 font-bold">Added {schedule.name}</p>}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t border-ink/15 pt-8">
          <button type="submit" className="rounded-full bg-ink px-6 py-4 text-lg font-bold text-cloud hover:bg-ink/90">
            Plan my week
          </button>
          <Link href="/week" className="rounded-full border-2 border-ink px-6 py-4 text-lg font-bold hover:bg-ink/10">
            Use the demo profile
          </Link>
        </div>
      </form>
    </main>
  );
}
