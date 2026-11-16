"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import Mascot from "@/components/Mascot";
import { MASCOT, PRODUCT } from "@/components/brand";
import { BUILDING_HINTS, CAMPUS_CHOICES, COMMUTE_CHOICES, STARTS } from "@/components/campus-options";
import { classProblem, isBlankClass } from "@/components/classes";
import { INTEREST_CHIPS } from "@/components/interests";
import { clearSetup, forgetToken, loadSetup, loadToken, saveSetup, type SavedSetup } from "@/components/setup-store";
import { WEEKDAYS } from "@/components/time";
import { isCampus } from "@/lib/campuses";
import type { CampusId, ClassBlock, CommuteBy, Weekday } from "@/lib/types";

const CANVAS_SETTINGS = "https://canvas.asu.edu/profile/settings";

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

// The saved setup, read once the page is in the browser (the server render has no storage). It is returned as
// JSON text so the snapshot stays equal between reads; nothing outside this page changes it while it is open.
const noUpdates = () => () => {};
const readSaved = () => {
  const saved = loadSetup();
  return saved ? JSON.stringify(saved) : "";
};
const readTokenSaved = () => Boolean(loadToken());
const onServerText = () => "";
const onServerFlag = () => false;

const CANT_READ = `${MASCOT} couldn’t read that. Try again, or type your classes in.`;
const OFFLINE = "No connection. Check the Wi-Fi and try again, or type your classes in.";

/**
 * Setup opens with what the student saved before, so changing one class does not mean typing every class
 * again. The form is keyed by the saved setup: the first browser render matches the server's empty form,
 * then the form starts over once, filled in.
 */
export default function SetupPage() {
  const savedText = useSyncExternalStore(noUpdates, readSaved, onServerText);
  const tokenSaved = useSyncExternalStore(noUpdates, readTokenSaved, onServerFlag);
  const saved = savedText ? (JSON.parse(savedText) as SavedSetup) : null;
  return <SetupForm key={savedText || "new"} saved={saved} tokenSaved={tokenSaved} />;
}

function SetupForm({ saved, tokenSaved }: { saved: SavedSetup | null; tokenSaved: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(saved?.name ?? "");
  const [token, setToken] = useState(""); // a saved token is never shown again; leaving this blank keeps it
  const [method, setMethod] = useState<Method>(saved ? "type" : "photo");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState("");
  const [classes, setClasses] = useState<ClassBlock[]>(saved?.classes ?? []);
  const [interests, setInterests] = useState<string[]>(saved?.interests ?? []);
  const [checked, setChecked] = useState(false); // mark rows that need a fix only after a save attempt
  const [saveError, setSaveError] = useState("");
  const [start, setStart] = useState(saved?.startBuildingId ?? ""); // where the first walk starts (building id)
  const [homeCampus, setHomeCampus] = useState<CampusId>(saved?.homeCampus ?? "tempe");
  const [offCampus, setOffCampus] = useState(Boolean(saved?.commute)); // lives off campus: the day starts with a commute
  const [commuteBy, setCommuteBy] = useState<CommuteBy>(saved?.commute?.by ?? "drive");
  const [commuteMinutes, setCommuteMinutes] = useState(saved?.commute ? String(saved.commute.minutes) : "");
  const [slower, setSlower] = useState(saved?.pace === "slower"); // "Give me more time to walk"
  const [tokenNote, setTokenNote] = useState(
    tokenSaved ? "A Canvas token is saved in this tab. Leave this blank to keep it." : "",
  );

  const canRead = (method === "photo" && photo !== null) || (method === "paste" && pasted.trim().length > 0);

  async function readSchedule() {
    setReading(true);
    setMessage(`${MASCOT} is reading your schedule…`);
    try {
      const form = new FormData();
      if (method === "photo" && photo) form.append("image", await shrinkPhoto(photo), photo.name);
      if (method === "paste") form.append("text", pasted);
      const res = await fetch("/api/schedule", { method: "POST", body: form });
      // A timeout or a platform error answers with a page, not JSON: fall back to Sol's own words.
      const body = (await res.json().catch(() => ({}))) as { classes?: ClassBlock[]; error?: string };
      if (!res.ok || !body.classes) throw new Error(body.error ?? CANT_READ);
      setClasses(body.classes);
      setMessage(`Found ${body.classes.length === 1 ? "1 class" : `${body.classes.length} classes`}. Check them below and fix anything that looks off.`);
    } catch (e) {
      // fetch throws a TypeError only when the network is down; other messages are the server's or ours
      setMessage(e instanceof TypeError ? OFFLINE : e instanceof Error ? e.message : CANT_READ);
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
    const minutes = Number(commuteMinutes);
    if (offCampus && !(Number.isInteger(minutes) && minutes >= 1 && minutes <= 120)) {
      setSaveError("Add how many minutes it takes you to get from home to class, from 1 to 120.");
      return;
    }
    const kept = rows.map((c) => ({ ...c, course: c.course.trim(), location: c.location?.trim() || undefined }));
    // The token stays in this tab only. It goes to Canvas through our server and is never stored there.
    saveSetup(
      {
        name: name.trim(),
        classes: kept,
        interests,
        startBuildingId: !offCampus && start ? start : undefined,
        homeCampus: homeCampus === "tempe" ? undefined : homeCampus,
        commute: offCampus ? { minutes, by: commuteBy } : undefined,
        pace: slower ? "slower" : undefined,
      },
      token.trim() || loadToken() || "", // blank keeps the token already saved in this tab
    );
    router.push("/today");
  }

  function forget() {
    forgetToken();
    setToken("");
    setTokenNote(`Done. ${PRODUCT} no longer has a Canvas token in this tab.`);
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
            {saved ? "Your setup" : "Let’s set up your day"}
          </h1>
          <p className="mt-2 text-lg text-ink-soft">
            {saved
              ? "Change anything here, then press Plan my day."
              : "Three steps, about two minutes. You only do this once."}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-10 space-y-12">
        <label className="block">
          <span className="font-display text-2xl font-bold">What should {MASCOT} call you?</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
            placeholder="Your first name"
            className={field}
          />
        </label>

        <fieldset>
          <legend className="font-display text-2xl font-bold">1. Connect Canvas</legend>
          <p className="mt-1 text-ink-soft">So {MASCOT} can see what’s due and whether you turned it in.</p>
          <a
            href={CANVAS_SETTINGS}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-full bg-ink px-5 py-3 font-bold text-cloud hover:bg-ink/90"
          >
            Open my Canvas settings
          </a>
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-ink-soft">
            <li>Under Approved integrations, select New access token.</li>
            <li>Name it {PRODUCT} and set Expires to the end of finals.</li>
            <li>Generate it and paste it here.</li>
          </ol>
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
          <div className="mt-4 space-y-2 rounded-3xl bg-cloud p-4 text-sm">
            <p>
              <span className="font-bold">What {PRODUCT} reads:</span> your Canvas to-do list, planner and course
              names.
            </p>
            <p>
              <span className="font-bold">What it never does:</span> submit, post or message anyone. It never asks
              for your ASU password.
            </p>
            <p>
              <span className="font-bold">Where the token lives:</span> only in this browser tab. Each plan sends it
              to Canvas through our server, which never stores or logs it. Your calendar feed holds planned times
              only.
            </p>
            <p>
              <span className="font-bold">Remove it any time:</span> in Canvas, open Settings, then Approved
              integrations, and delete {PRODUCT}.{" "}
              <button
                type="button"
                onClick={forget}
                className="-my-2.5 inline-flex min-h-10 items-center font-bold underline underline-offset-4"
              >
                Forget my token here
              </button>
            </p>
            {tokenNote && (
              <p role="status" className="font-bold text-saguaro">
                {tokenNote}
              </p>
            )}
          </div>
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
                        <span className="font-bold">Class or shift</span>
                        <input
                          value={c.course}
                          onChange={(e) => updateClass(index, { course: e.target.value })}
                          placeholder="CSE 240 or MU shift"
                          className={field}
                        />
                      </label>
                      <label className="block">
                        <span className="font-bold">Campus</span>
                        <select
                          value={c.campus ?? "tempe"}
                          onChange={(e) => {
                            const campus = isCampus(e.target.value) ? e.target.value : "tempe";
                            updateClass(index, { campus: campus === "tempe" ? undefined : campus });
                          }}
                          className={field}
                        >
                          {CAMPUS_CHOICES.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="font-bold">Building and room</span>
                        <input
                          value={c.location ?? ""}
                          onChange={(e) => updateClass(index, { location: e.target.value })}
                          placeholder={BUILDING_HINTS[c.campus ?? "tempe"][0] + " 210"}
                          list={`building-hints-${c.campus ?? "tempe"}`}
                          className={field}
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
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
                            className={`min-h-10 rounded-full border-2 px-3 py-1.5 font-bold ${
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
                        className="ml-auto min-h-10 rounded-full px-3 py-1.5 font-bold text-ink-soft hover:bg-ink/10"
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
              Add a class or a shift
            </button>
          )}

          <div className="mt-8">
            <p className="font-bold" id="start-label">
              Where does your day start?
            </p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="start-label">
              {[
                { off: false, label: "On campus" },
                { off: true, label: "At home, off campus" },
              ].map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  aria-pressed={offCampus === choice.off}
                  onClick={() => setOffCampus(choice.off)}
                  className={`rounded-full border-2 px-4 py-2 font-bold ${
                    offCampus === choice.off ? "border-ink bg-ink text-cloud" : "border-ink/20 bg-cloud hover:border-ink"
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="font-bold">{offCampus ? "Campus closest to home" : "Campus"}</span>
                <select
                  value={homeCampus}
                  onChange={(e) => {
                    setHomeCampus(isCampus(e.target.value) ? e.target.value : "tempe");
                    setStart(""); // a dorm on one campus is not a place on another
                  }}
                  className={field}
                >
                  {CAMPUS_CHOICES.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              {offCampus ? (
                <label className="block">
                  <span className="font-bold">Minutes from your door to class</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={120}
                    value={commuteMinutes}
                    onChange={(e) => setCommuteMinutes(e.target.value)}
                    placeholder="25"
                    className={field}
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="font-bold">Building</span>
                  <select value={start} onChange={(e) => setStart(e.target.value)} className={field}>
                    <option value="">Not sure yet</option>
                    {STARTS[homeCampus].map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {offCampus ? (
              <>
                <p className="mt-4 font-bold" id="commute-label">
                  How do you get there?
                </p>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="commute-label">
                  {COMMUTE_CHOICES.map((choice) => (
                    <button
                      key={choice.by}
                      type="button"
                      aria-pressed={commuteBy === choice.by}
                      onClick={() => setCommuteBy(choice.by)}
                      className={`min-h-10 rounded-full border-2 px-3 py-1.5 font-bold ${
                        commuteBy === choice.by ? "border-ink bg-ink text-cloud" : "border-ink/20 hover:border-ink"
                      }`}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm text-ink-soft">
                  {MASCOT} has you leave this many minutes before your first class and never asks for your address. A
                  class on another campus adds the ASU shuttle from this one.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">
                {MASCOT} times your first walk from here. A class on another campus gets the ASU shuttle.
              </p>
            )}
          </div>

          <label className="mt-6 flex items-start gap-3">
            <input
              type="checkbox"
              checked={slower}
              onChange={(e) => setSlower(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-[#14324a]"
            />
            <span>
              <span className="font-bold">Give me more time to walk</span>
              <span className="block text-sm text-ink-soft">
                For a slower pace, a mobility aid, or if heat hits you hard. {MASCOT} has you leave earlier for every
                class, and earlier again on hot days.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset>
          <legend className="font-display text-2xl font-bold">3. Pick what you enjoy</legend>
          <p className="mt-1 text-ink-soft">{MASCOT} uses these to pick club events for you. Yes, free food counts.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {INTEREST_CHIPS.map(({ key, label }) => {
              const on = interests.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleInterest(key)}
                  className={`rounded-full border-2 px-4 py-2 font-bold ${
                    on ? "border-dusk bg-dusk text-cloud" : "border-ink/20 bg-cloud hover:border-ink"
                  }`}
                >
                  {label}
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
      {CAMPUS_CHOICES.map(({ id }) => (
        <datalist key={id} id={`building-hints-${id}`}>
          {BUILDING_HINTS[id].map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      ))}
    </main>
  );
}
