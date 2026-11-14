"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Mascot from "@/components/Mascot";
import { MASCOT, PRODUCT } from "@/components/brand";
import { WEEKDAYS } from "@/components/time";
import type { ClassBlock, StudentSetup, Weekday } from "@/lib/types";
import { SETUP_KEY, TOKEN_KEY } from "@/lib/api-client";

// Building choices for the class form; the planner matches these codes to data/buildings.json.
const BUILDINGS = [
  { code: "BYENG", name: "Brickyard Engineering" },
  { code: "COOR", name: "Coor Hall" },
  { code: "ECG", name: "Engineering Center G Wing" },
  { code: "ISTB4", name: "Interdisciplinary Science and Technology Building 4" },
  { code: "LL", name: "Language and Literature" },
  { code: "MU", name: "Memorial Union" },
  { code: "PSH", name: "Physical Sciences H Wing" },
  { code: "WXLR", name: "Wexler Hall" },
];

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

type Method = "photo" | "paste" | "type";

const METHODS: { value: Method; label: string }[] = [
  { value: "photo", label: "Take a photo" },
  { value: "paste", label: "Paste text" },
  { value: "type", label: "Type them in" },
];

const field = "mt-1 w-full rounded-2xl border-2 border-ink/20 bg-cloud px-4 py-3 focus:border-ink";

const emptyClass = (): ClassBlock => ({ course: "", days: [], start: "09:00", end: "09:50", building: "" });

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [method, setMethod] = useState<Method>("photo");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState("");
  const [classes, setClasses] = useState<ClassBlock[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  const canRead = (method === "photo" && photo !== null) || (method === "paste" && pasted.trim().length > 0);

  async function readSchedule() {
    const form = new FormData();
    if (method === "photo" && photo) form.append("image", photo);
    if (method === "paste") form.append("text", pasted);
    setReading(true);
    setMessage(`${MASCOT} is reading your schedule…`);
    try {
      const res = await fetch("/api/schedule", { method: "POST", body: form });
      const body = (await res.json()) as { classes?: ClassBlock[]; error?: string };
      if (!res.ok || !body.classes) throw new Error(body.error ?? "That did not work. Try again.");
      setClasses(body.classes);
      setMessage(`Found ${body.classes.length} classes. Check them below and fix anything that looks off.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "That did not work. Try again.");
    } finally {
      setReading(false);
    }
  }

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

  function chooseMethod(value: Method) {
    setMethod(value);
    if (value === "type" && classes.length === 0) setClasses([emptyClass()]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const setup: StudentSetup = {
      name: name.trim() || "there",
      classes: classes.filter((c) => c.course.trim() && c.days.length),
      interests,
    };
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
      // The token stays in this tab only. It goes to Canvas through our server and is never stored there.
      if (token.trim()) sessionStorage.setItem(TOKEN_KEY, token.trim());
      else sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem("daypilot.accepted"); // events picked for the sample day do not carry over
    } catch {
      // storage blocked (private mode): the sample day still works
    }
    router.push("/today");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/" className="flex items-center gap-2">
        <Mascot size={40} label="" />
        <span className="font-display text-2xl font-bold tracking-tight">{PRODUCT}</span>
      </Link>

      <div className="mt-10 flex items-center gap-4">
        <Mascot size={96} animated className="shrink-0" />
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Let’s set up your day
          </h1>
          <p className="mt-2 text-lg text-ink-soft">Three steps, about two minutes. You only do this once.</p>
        </div>
      </div>

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
            {PRODUCT} never asks for your ASU password. The token stays in this browser tab and is never stored on
            our server.
          </p>
        </fieldset>

        <fieldset>
          <legend className="font-display text-2xl font-bold">2. Add your classes</legend>
          <p className="mt-1 text-ink-soft">
            Snap your class schedule or paste it from MyASU, and {MASCOT} fills in the rest.
          </p>

          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="How to add classes">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={method === m.value}
                onClick={() => chooseMethod(m.value)}
                className={`rounded-full border-2 px-4 py-2 font-bold ${
                  method === m.value ? "border-ink bg-ink text-cloud" : "border-ink/20 bg-cloud hover:border-ink"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {method === "photo" && (
            <label className="mt-4 block cursor-pointer rounded-3xl border-2 border-dashed border-ink/30 bg-cloud p-6 text-center hover:border-ink">
              <span className="block font-display text-xl font-bold">
                {photo ? photo.name : "Take a photo or choose a screenshot"}
              </span>
              <span className="mt-1 block text-ink-soft">
                Your MyASU schedule, a printout or the whiteboard in your dorm all work.
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
          )}

          {method === "paste" && (
            <label className="mt-4 block">
              <span className="sr-only">Schedule text</span>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={6}
                placeholder="Copy your class list from MyASU and paste it here"
                className={field}
              />
            </label>
          )}

          {method !== "type" && (
            <button
              type="button"
              disabled={!canRead || reading}
              onClick={readSchedule}
              className="mt-4 rounded-full bg-ink px-5 py-3 font-bold text-cloud hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {reading ? "Reading…" : "Read my schedule"}
            </button>
          )}

          <p aria-live="polite" className="mt-3 font-bold">
            {message}
          </p>

          {classes.length > 0 && (
            <div className="mt-4 space-y-4">
              {classes.map((c, index) => {
                const knownBuilding = BUILDINGS.some((b) => b.code === c.building);
                return (
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
                          {!knownBuilding && c.building && <option value={c.building}>{c.building}</option>}
                          {BUILDINGS.map((b) => (
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
                    <div className="mt-1 flex flex-wrap items-center gap-2">
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
                      <button
                        type="button"
                        onClick={() => setClasses((prev) => prev.filter((_, i) => i !== index))}
                        className="ml-auto rounded-full px-3 py-1.5 font-bold text-ink-soft hover:bg-ink/10"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(method === "type" || classes.length > 0) && (
            <button
              type="button"
              onClick={() => setClasses((prev) => [...prev, emptyClass()])}
              className="mt-4 rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10"
            >
              Add a class
            </button>
          )}
        </fieldset>

        <fieldset>
          <legend className="font-display text-2xl font-bold">3. Pick what you enjoy</legend>
          <p className="mt-1 text-ink-soft">{MASCOT} uses these to choose club events for you.</p>
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
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(SETUP_KEY);
                sessionStorage.removeItem(TOKEN_KEY);
                sessionStorage.removeItem("daypilot.accepted");
              } catch {
                // nothing saved
              }
              router.push("/today");
            }}
            className="rounded-full border-2 border-ink px-6 py-4 text-lg font-bold hover:bg-ink/10"
          >
            Use the sample student
          </button>
        </div>
      </form>
    </main>
  );
}
