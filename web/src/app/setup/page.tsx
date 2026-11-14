"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Mascot from "@/components/Mascot";
import { PRODUCT } from "@/components/brand";
import { WEEKDAYS } from "@/components/time";
import type { ClassBlock, StudentSetup, Weekday } from "@/lib/types";
import { demoBuildings } from "@/mocks/day";

const INTERESTS = [
  "Robotics",
  "Soccer",
  "Hiking",
  "Gaming",
  "Music",
  "Volunteering",
  "Startups",
  "Art and design",
  "Meeting first-gen students",
  "Meeting international students",
];

const field = "mt-1 w-full rounded-2xl border-2 border-ink/20 bg-cloud px-4 py-3 focus:border-ink";

const emptyClass = (): ClassBlock => ({ course: "", days: [], start: "09:00", end: "09:50", building: "" });

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [classes, setClasses] = useState<ClassBlock[]>([emptyClass()]);
  const [interests, setInterests] = useState<string[]>([]);

  function updateClass(index: number, patch: Partial<ClassBlock>) {
    setClasses((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function toggleDay(index: number, day: Weekday) {
    const days = classes[index].days;
    updateClass(index, { days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] });
  }

  function toggleInterest(value: string) {
    setInterests((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const setup: StudentSetup = {
      name: name.trim() || "there",
      classes: classes.filter((c) => c.course.trim() && c.days.length),
      interests,
    };
    try {
      localStorage.setItem("daypilot.setup", JSON.stringify(setup));
      // The token stays in this tab only. It goes to Canvas through our server and is never stored there.
      if (token.trim()) sessionStorage.setItem("daypilot.canvasToken", token.trim());
    } catch {
      // storage blocked (private mode): the demo day still works
    }
    router.push("/today");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/" className="flex items-center gap-2">
        <Mascot size={40} />
        <span className="font-display text-2xl font-bold tracking-tight">{PRODUCT}</span>
      </Link>

      <h1 className="mt-10 font-display text-5xl font-bold leading-tight tracking-tight">Set up your day</h1>
      <p className="mt-3 text-lg text-ink-soft">Three steps. You only do this once.</p>

      <form onSubmit={submit} className="mt-10 space-y-12">
        <fieldset>
          <legend className="font-display text-2xl font-bold">1. Connect Canvas</legend>
          <label className="mt-4 block">
            <span className="font-bold">Your first name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" className={field} />
          </label>
          <label className="mt-4 block">
            <span className="font-bold">Canvas access token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              placeholder="Paste the token here"
              className={field}
            />
          </label>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-ink-soft">
            <li>In Canvas, open Account, then Settings.</li>
            <li>Under Approved integrations, select New access token.</li>
            <li>Name it {PRODUCT}, generate it and paste it above.</li>
          </ol>
          <p className="mt-3 text-sm text-ink-soft">
            {PRODUCT} never asks for your ASU password. The token stays in this browser tab and is never stored
            on our server.
          </p>
        </fieldset>

        <fieldset>
          <legend className="font-display text-2xl font-bold">2. Add your classes</legend>
          <p className="mt-1 text-ink-soft">MyASU has no way to share these, so add them once.</p>
          <div className="mt-4 space-y-4">
            {classes.map((c, index) => (
              <div key={index} className="rounded-3xl border-2 border-ink/15 bg-cloud p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="font-bold">Course</span>
                    <input
                      value={c.course}
                      onChange={(e) => updateClass(index, { course: e.target.value })}
                      placeholder="CSE 240"
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className="font-bold">Building</span>
                    <select
                      value={c.building}
                      onChange={(e) => updateClass(index, { building: e.target.value })}
                      className={field}
                    >
                      <option value="">Choose a building</option>
                      {demoBuildings.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-bold">Starts</span>
                    <input
                      type="time"
                      value={c.start}
                      onChange={(e) => updateClass(index, { start: e.target.value })}
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className="font-bold">Ends</span>
                    <input
                      type="time"
                      value={c.end}
                      onChange={(e) => updateClass(index, { end: e.target.value })}
                      className={field}
                    />
                  </label>
                </div>
                <p className="mt-3 font-bold">Days</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {WEEKDAYS.slice(0, 5).map((day) => {
                    const on = c.days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDay(index, day)}
                        className={`rounded-full border-2 px-3 py-1.5 font-bold ${
                          on ? "border-ink bg-ink text-cloud" : "border-ink/20 hover:border-ink"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setClasses((prev) => [...prev, emptyClass()])}
            className="mt-4 rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10"
          >
            Add another class
          </button>
        </fieldset>

        <fieldset>
          <legend className="font-display text-2xl font-bold">3. Pick what you enjoy</legend>
          <p className="mt-1 text-ink-soft">{PRODUCT} uses these to choose club events for you.</p>
          <div className="mt-4 flex flex-wrap gap-2">
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

        <div className="flex flex-wrap items-center gap-3 border-t border-ink/15 pt-8">
          <button type="submit" className="rounded-full bg-ink px-6 py-4 text-lg font-bold text-cloud hover:bg-ink/90">
            Plan my day
          </button>
          <Link href="/today" className="rounded-full border-2 border-ink px-6 py-4 text-lg font-bold hover:bg-ink/10">
            Use the sample student
          </Link>
        </div>
      </form>
    </main>
  );
}
