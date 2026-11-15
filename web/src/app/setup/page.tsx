"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Mascot from "@/components/Mascot";
import { MASCOT, PRODUCT } from "@/components/brand";
import { classProblem, isBlankClass } from "@/components/classes";
import { clearSetup, saveSetup } from "@/components/setup-store";
import { WEEKDAYS } from "@/components/time";
import type { ClassBlock, Weekday } from "@/lib/types";

// Lowercase, so they match event tags from ASU Events and Sun Devil Central.
const INTERESTS = [
  "robotics",
  "software",
  "hackathons",
  "career",
  "soccer",
  "sports",
  "music",
  "arts",
  "volunteering",
  "startups",
];

// Hints for the location field; the planner matches "BYENG 210" to data/buildings.json.
const BUILDING_HINTS = ["BYENG", "COOR", "ECG", "ISTB4", "LL", "MU", "PSH", "SDFC", "WXLR", "Hayden Library"];

type Method = "photo" | "paste" | "type";

const METHODS: { value: Method; label: string }[] = [
  { value: "photo", label: "Take a photo" },
  { value: "paste", label: "Paste text" },
  { value: "type", label: "Type them in" },
];

const field = "mt-1 w-full rounded-2xl border-2 border-ink/20 bg-cloud px-4 py-3 focus:border-ink";

const emptyClass = (): ClassBlock => ({ course: "", days: [], start: "09:00", end: "09:50", location: "" });

const ERROR = "text-[#b91c1c]";

/**
 * Phone photos are often 3 to 6 MB, and the server (Vercel) rejects uploads over 4.5 MB. Large photos are
 * redrawn at 1600 px on the long side as JPEG, which keeps the schedule readable at a few hundred KB.
 */
async function shrinkPhoto(file: File): Promise<Blob> {
  if (file.size < 1_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return jpeg ?? file;
  } catch {
    return file; // this browser cannot redraw the format (for example HEIC on desktop): send the original
  }
}

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
  const [checked, setChecked] = useState(false); // mark rows that need a fix only after a save attempt
  const [saveError, setSaveError] = useState("");

  const canRead = (method === "photo" && photo !== null) || (method === "paste" && pasted.trim().length > 0);

  async function readSchedule() {
    setReading(true);
    setMessage(`${MASCOT} is reading your schedule…`);
    try {
      const form = new FormData();
      if (method === "photo" && photo) form.append("image", await shrinkPhoto(photo), photo.name);
      if (method === "paste") form.append("text", pasted);
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
    const rows = classes.filter((c) => !isBlankClass(c));
    if (rows.length === 0) {
      setSaveError("Add at least one class, or use the sample student.");
      return;
    }
    if (rows.some((c) => classProblem(c))) {
      setChecked(true);
      setSaveError("Some classes need a fix. They are marked in step 2.");
      return;
    }
    const kept = rows.map((c) => ({ ...c, course: c.course.trim(), location: c.location?.trim() || undefined }));
    // The token stays in this tab only. It goes to Canvas through our server and is never stored there.
    saveSetup({ name: name.trim(), classes: kept, interests }, token.trim());
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
                const issue = checked && !isBlankClass(c) ? classProblem(c) : "";
                return (
                  <div
                    key={index}
                    className={`rounded-3xl border-2 bg-cloud p-4 ${issue ? "border-[#b91c1c]" : "border-ink/15"}`}
                  >
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
                        <span className="font-bold">Building and room</span>
                        <input
                          value={c.location ?? ""}
                          onChange={(e) => updateClass(index, { location: e.target.value })}
                          placeholder="BYENG 210"
                          list="building-hints"
                          className={field}
                        />
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
                      {WEEKDAYS.map((day) => {
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
                    {issue && <p className={`mt-3 font-bold ${ERROR}`}>{issue}</p>}
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
                  className={`rounded-full border-2 px-4 py-2 font-bold capitalize ${
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
              clearSetup();
              router.push("/today");
            }}
            className="rounded-full border-2 border-ink px-6 py-4 text-lg font-bold hover:bg-ink/10"
          >
            Use the sample student
          </button>
          {saveError && (
            <p role="alert" className={`w-full font-bold ${ERROR}`}>
              {saveError}
            </p>
          )}
        </div>
      </form>
      <datalist id="building-hints">
        {BUILDING_HINTS.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </main>
  );
}
