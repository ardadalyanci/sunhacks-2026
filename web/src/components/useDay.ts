"use client";

// Loads the student's day from the backend routes and keeps it in sync with what they add or remove.
// No saved setup → the sample day from GET /api/demo (works with no token, feeds or Wi-Fi).
// Saved setup → POST /api/canvas (if a token is saved) + GET /api/events + GET /api/weather → POST /api/plan.
// `date` picks a later day (up to 6 days ahead); /api/plan then plans and briefs it as a look-ahead.
// Pages share loaded days for a few minutes, so moving between Today and Events (or React's StrictMode
// double mount in dev) does not call Canvas, the feeds and Gemini again. Only the newest re-plan may change
// the screen, so a voice command and a button press never overwrite each other.
// The "What if…" pills never change the student's real request: each plan sends a copy with them applied, and
// Sol says in one line what the re-plan changed (`change`).
import { useEffect, useRef, useState } from "react";
import type { CommandAction, DayItem, DayPlan, Opportunity, PlanRequest, Weather } from "@/lib/types";
import { createShared, newestWins } from "./loading";
import { describeChange, type Cause } from "./plan-diff";
import {
  itemKey,
  loadAccepted,
  loadCalendarId,
  loadHidden,
  loadSetup,
  loadToken,
  saveAccepted,
  saveHidden,
} from "./setup-store";
import { arizonaToday, formatTime, parseLocal } from "./time";
import { useNow } from "./useNow";
import { NO_WHAT_IF, applyWhatIf, baseNow, skipCandidate, whatIfCause, type WhatIf } from "./what-if";

const REUSE_MS = 5 * 60_000; // how long a loaded day is reused when moving between pages

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request to ${url} failed (${res.status}).`);
  return json;
}

/** GET `url` as JSON; null when it fails, answers an error, or takes longer than `timeoutMs`. */
async function getJson<T>(url: string, timeoutMs?: number): Promise<T | null> {
  try {
    const res = await fetch(url, timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : undefined);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const LIVE_EVENTS_WAIT_MS = 2500; // the sample day waits this long for the live feeds, then goes without them

function asEvents(value: unknown): Opportunity[] {
  if (Array.isArray(value)) return value as Opportunity[];
  const events = (value as { events?: unknown } | null)?.events;
  return Array.isArray(events) ? (events as Opportunity[]) : [];
}

const asEventItemId = (id: string) => (id.startsWith("ev-") ? id : `ev-${id}`);

const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

type Loaded = {
  request: PlanRequest; // the student's real request, before any "What if…" pill
  name: string;
  isDemo: boolean;
  notice: string;
};

/** A planned day: the real request, the pills that were on, what was sent to /api/plan, and its answer. */
type Day = { loaded: Loaded; whatIf: WhatIf; request: PlanRequest; plan: DayPlan };
type Inputs = { loaded: Loaded; whatIf: WhatIf };

/** The plan request for `date`; a date after `today` is a look-ahead. */
async function buildRequest(date: string, today: string): Promise<Loaded> {
  const later = date > today;
  const setup = loadSetup();
  if (!setup) {
    // Today's sample day replays 8 am; a later day comes back with the real clock as its `now`.
    // The sample student's own events are joined by the live ASU feeds when they answer in time, so the
    // sample shows real campus events too, and still works offline.
    const [demo, live] = await Promise.all([
      getJson<{ persona: { name: string }; request: PlanRequest }>(later ? `/api/demo?date=${date}` : "/api/demo"),
      getJson<unknown>("/api/events", LIVE_EVENTS_WAIT_MS).then(asEvents),
    ]);
    if (!demo) throw new Error("The sample day did not load. Check that the app server is running.");
    return {
      request: {
        ...demo.request,
        events: [...(demo.request.events ?? []), ...live],
        acceptedEventIds: loadAccepted(date),
        calendarId: loadCalendarId(),
      },
      name: demo.persona.name,
      isDemo: true,
      notice: "",
    };
  }

  let notice = "";
  const token = loadToken();
  const [deadlines, events, weather] = await Promise.all([
    token
      ? postJson<{ deadlines: DayItem[] }>("/api/canvas", { token, date })
          .then((r) => r.deadlines)
          .catch((e: Error) => {
            notice = `Canvas did not load: ${e.message} Your classes and events are still here.`;
            return [] as DayItem[];
          })
      : Promise.resolve([] as DayItem[]),
    getJson<unknown>("/api/events").then(asEvents),
    getJson<Weather>(later ? `/api/weather?date=${date}` : "/api/weather"),
  ]);
  if (!token) notice = "Add your Canvas token in Setup to see your assignments here.";

  return {
    request: {
      date,
      classes: setup.classes,
      deadlines,
      events,
      acceptedEventIds: loadAccepted(date),
      interests: setup.interests,
      weather: weather ?? undefined,
      startBuildingId: setup.startBuildingId,
      pace: setup.pace,
      calendarId: loadCalendarId(), // /api/plan saves the day for the calendar feed (MongoDB) and sets calendarUrl
    },
    name: setup.name,
    isDemo: false,
    notice,
  };
}

async function loadDay(date: string, today: string): Promise<Day> {
  const loaded = await buildRequest(date, today);
  const plan = await postJson<DayPlan>("/api/plan", loaded.request);
  return { loaded, whatIf: NO_WHAT_IF, request: loaded.request, plan }; // a newly loaded day starts with every pill off
}

/** Short hash, so the cache key changes with the Canvas token without holding the token itself. */
function fingerprint(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(36);
}

/** Everything in the browser that the day `date` depends on. When any of it changes, the day is loaded again. */
function inputKey(date: string) {
  const today = arizonaToday();
  return JSON.stringify([date, today, loadSetup(), fingerprint(loadToken() ?? ""), [...loadAccepted(date)].sort()]);
}

// Loaded days for this browser tab, shared by every page that calls useDay().
const shared = createShared<Day>(REUSE_MS);

/** The plan without the timeline items the student removed. */
function visible(plan: DayPlan, hidden: string[]): DayPlan {
  return { ...plan, items: plan.items.filter((i) => !hidden.includes(itemKey(i))) };
}

/** The student's day: today by default, or `date` ("2026-11-16") for a later day. */
export function useDay(date?: string) {
  const [day, setDay] = useState<Day | null>(null); // the day on screen
  const [whatIf, setWhatIfState] = useState<WhatIf>(NO_WHAT_IF); // the pills move at once, the plan follows
  const [change, setChange] = useState(""); // Sol's note on what the last re-plan changed
  const [hidden, setHidden] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [run] = useState(() => newestWins<DayPlan>());
  const clockNow = useNow();

  // Actions read these refs instead of a past render, so quick actions (a voice command while a button
  // press is still planning) always build on each other.
  const shown = useRef<Day | null>(null); // the day on screen
  const wanted = useRef<Inputs | null>(null); // the newest inputs, possibly still being planned
  const hiddenRef = useRef<string[]>([]);
  const chosen = useRef(""); // the day the page asked for; a late answer for another day is not shown

  useEffect(() => {
    const today = arizonaToday();
    const wantedDate = date || today;
    chosen.current = wantedDate;
    let active = true;
    shared.get(inputKey(wantedDate), () => loadDay(wantedDate, today)).then(
      (loaded) => {
        if (!active) return;
        if (shown.current?.plan.date !== loaded.plan.date) setChange(""); // the note belongs to the day it was about
        shown.current = loaded;
        wanted.current = { loaded: loaded.loaded, whatIf: loaded.whatIf };
        hiddenRef.current = loadHidden(loaded.plan.date);
        setDay(loaded);
        setWhatIfState(loaded.whatIf);
        setHidden(hiddenRef.current);
        setError("");
        setBusy(false);
      },
      (e: unknown) => {
        if (!active) return;
        setError(message(e));
        setBusy(false);
      },
    );
    return () => {
      active = false;
    };
  }, [date]);

  /**
   * Plans `next` (the real request with its pills applied); resolves to the plan the student ends up seeing, or
   * null when planning failed. `cause` is what Sol's note explains once the new plan is on screen.
   */
  function replan(next: Inputs, cause: Cause | null): Promise<DayPlan | null> {
    wanted.current = next;
    setBusy(true);
    const real = next.loaded.request;
    const request = applyWhatIf(real, real.weather, next.whatIf, baseNow(real, Date.now()));
    return run(
      () => postJson<DayPlan>("/api/plan", request),
      (plan) => {
        const planned: Day = { ...next, request, plan };
        shared.set(inputKey(plan.date), planned);
        setBusy(false);
        if (plan.date !== chosen.current) return; // the student moved to another day meanwhile
        const before = shown.current;
        shown.current = planned;
        setDay(planned);
        setError("");
        if (cause && before?.plan.date === plan.date) {
          const hidden = hiddenRef.current;
          const now = request.now ?? baseNow(real, Date.now());
          setChange(
            describeChange(cause, visible(before.plan, hidden), visible(plan, hidden), { now, deadlines: request.deadlines }),
          );
        }
      },
      (e) => {
        setBusy(false);
        if (next.loaded.request.date !== chosen.current) return;
        // Go back to the day on screen, so the pills and the saved events match what the student sees.
        const back = shown.current;
        if (back) {
          wanted.current = { loaded: back.loaded, whatIf: back.whatIf };
          saveAccepted(back.plan.date, back.loaded.request.acceptedEventIds ?? []);
          setWhatIfState(back.whatIf);
        }
        setError(message(e));
      },
    );
  }

  /** Turns "What if…" pills on or off, for example `setWhatIf({ overslept: true })`, and plans the day again. */
  async function setWhatIf(patch: Partial<WhatIf>) {
    const now = wanted.current;
    if (!now) return;
    const next = { ...now.whatIf, ...patch };
    setWhatIfState(next);
    const real = now.loaded.request;
    await replan({ loaded: now.loaded, whatIf: next }, whatIfCause(now.whatIf, next, real.weather, baseNow(real, Date.now())));
  }

  const setHotPreview = (value: boolean) => setWhatIf({ hot: value });

  function setAccepted(now: Inputs, ids: string[], cause: Cause) {
    saveAccepted(now.loaded.request.date ?? arizonaToday(), ids);
    return replan({ ...now, loaded: { ...now.loaded, request: { ...now.loaded.request, acceptedEventIds: ids } } }, cause);
  }

  /** Puts an event on the day. Resolves to the new plan, or null when planning failed. */
  async function accept(itemId: string): Promise<DayPlan | null> {
    const now = wanted.current;
    if (!now) return null;
    const id = asEventItemId(itemId);
    const ids = now.loaded.request.acceptedEventIds ?? [];
    if (ids.map(asEventItemId).includes(id)) return shown.current?.plan ?? null;
    return setAccepted(now, [...ids, id], { kind: "added", id });
  }

  /** Takes an added event off the day. Resolves to the new plan, or null when planning failed. */
  async function unaccept(itemId: string): Promise<DayPlan | null> {
    const now = wanted.current;
    if (!now) return null;
    const id = asEventItemId(itemId);
    return setAccepted(
      now,
      (now.loaded.request.acceptedEventIds ?? []).filter((x) => asEventItemId(x) !== id),
      { kind: "removed", id },
    );
  }

  /** Removes an item from today's timeline in this browser, for example a study block. */
  function hide(itemId: string) {
    const current = shown.current;
    const item = current?.plan.items.find((i) => i.id === itemId);
    if (!current || !item || hiddenRef.current.includes(itemKey(item))) return;
    hiddenRef.current = [...hiddenRef.current, itemKey(item)];
    saveHidden(current.plan.date, hiddenRef.current);
    setHidden(hiddenRef.current);
  }

  /** Runs a spoken or typed command and returns what Sol says back. Failures are said and shown. */
  async function command(text: string): Promise<string> {
    const current = shown.current;
    if (!current) return "Your day is still loading.";
    const plan = visible(current.plan, hiddenRef.current);
    // `now` is set for the sample day (it replays 8 am) and while "What if I oversleep?" is on; otherwise a real
    // day uses the server clock.
    const now = current.request.now;
    const action = await postJson<CommandAction>("/api/command", { text, plan, now });
    // "What's next?" and "When do I leave?" come back as a briefing with a short reply of their own.
    if (action.action === "briefing") return action.reply ?? plan.briefing;
    if (action.action === "unknown") return action.reply;

    if (action.action === "add_event") {
      const id = asEventItemId(action.itemId);
      const name = plan.suggestions.find((s) => s.id === id)?.title ?? "that event";
      if (plan.items.some((i) => i.id === id)) return `${name} is already on your day.`;
      const next = await accept(id);
      const added = next?.items.find((i) => i.id === id);
      if (added) return `Added ${added.title} at ${formatTime(parseLocal(added.start).hours)}.`;
      return next ? `${name} does not fit in your day.` : `I could not add ${name}. Try again in a moment.`;
    }

    const item = plan.items.find((i) => i.id === action.itemId);
    if (!item) return "I could not find that on your day.";
    if (item.type === "event") {
      const next = await unaccept(item.id);
      if (!next || next.items.some((i) => i.id === item.id)) {
        return `I could not remove ${item.title}. Try again in a moment.`;
      }
    } else {
      hide(item.id);
    }
    return `Removed ${item.title} from your day.`;
  }

  // A different day was picked and is still loading; the previous day stays on screen until it arrives.
  const switching = Boolean(date) && day !== null && day.plan.date !== date;

  // The class the "What if … is cancelled?" pill names: while it is on, the one that was cancelled.
  const candidate = day ? skipCandidate(day.loaded.request, day.plan, baseNow(day.loaded.request, clockNow)) : null;
  const skipKey = whatIf.skipped ?? candidate;

  return {
    plan: day ? visible(day.plan, hidden) : null,
    request: day?.request ?? null, // what was actually planned, with the pills applied
    name: day?.loaded.name ?? "",
    isDemo: day?.loaded.isDemo ?? true,
    notice: day?.loaded.notice ?? "",
    error,
    busy: busy || switching,
    switching,
    whatIf,
    setWhatIf,
    skip: skipKey?.course ?? null, // the class the "What if … is cancelled?" pill names, or null to hide it
    skipKey,
    change,
    hot: whatIf.hot,
    setHotPreview,
    accept,
    unaccept,
    hide,
    command,
  };
}
