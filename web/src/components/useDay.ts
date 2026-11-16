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
// Every failure is said in plain words (errors.ts) and leaves the app usable: the day on screen stays.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CampusId, CommandAction, DayItem, DayPlan, Opportunity, PlanRequest, Weather } from "@/lib/types";
import { briefingWithout } from "./briefing";
import { HttpError, canvasNotice, errorText, offlineAnswer } from "./errors";
import { createShared, newestWins } from "./loading";
import { describeChange, describeRemovedStudy, describeStack, type Cause } from "./plan-diff";
import {
  eventCampusQuery,
  itemKey,
  loadAccepted,
  loadCalendarId,
  loadHidden,
  loadSetup,
  loadToken,
  saveAccepted,
  saveHidden,
} from "./setup-store";
import { arizonaToday, formatDay, formatTime, parseLocal, weekDates } from "./time";
import { replaceChosenDay } from "./useChosenDay";
import { useNow } from "./useNow";
import {
  HOT_PREVIEW,
  NO_WHAT_IF,
  applyWhatIf,
  baseNow,
  skipCandidate,
  whatIfCause,
  type WhatIf,
} from "./what-if";

const REUSE_MS = 5 * 60_000; // how long a loaded day is reused when moving between pages
// A plan can take about 24 s on the server (two Gemini calls of up to 12 s); past this, venue Wi-Fi has stalled.
const REQUEST_LIMIT_MS = 30_000;

/** The answer's JSON, or an HttpError with the route's own `error` text when it answered with an error status. */
async function readJson<T>(res: Response, url: string): Promise<T> {
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new HttpError(res.status, json.error ?? `Request to ${url} failed (${res.status}).`);
  }
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_LIMIT_MS),
  });
  return readJson<T>(res, url);
}

/** GET `url` as JSON; null when it fails, answers an error, or takes longer than `timeoutMs`. */
async function getJson<T>(url: string, timeoutMs = REQUEST_LIMIT_MS): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
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

type Loaded = {
  request: PlanRequest; // the student's real request, before any "What if…" pill
  name: string;
  isDemo: boolean;
  notice: string;
};

/** A planned day: the real request, the pills that were on, what was sent to /api/plan, and its answer. */
/** One message in Sol's chat. */
export type ChatTurn = { from: "you" | "sol"; text: string };

type Day = { loaded: Loaded; whatIf: WhatIf; request: PlanRequest; plan: DayPlan };
type Inputs = { loaded: Loaded; whatIf: WhatIf };

/** Weather for the day, on the home campus when it is not Tempe. */
function weatherUrl(date: string | undefined, campus: CampusId | undefined): string {
  const query = new URLSearchParams();
  if (date) query.set("date", date);
  if (campus && campus !== "tempe") query.set("campus", campus);
  const text = query.toString();
  return text ? `/api/weather?${text}` : "/api/weather";
}

/** The plan request for `date`; a date after `today` is a look-ahead. */
async function buildRequest(date: string, today: string): Promise<Loaded> {
  const later = date > today;
  const setup = loadSetup();
  if (!setup) {
    // Today's sample day replays 8 am; a later day comes back with the real clock as its `now`.
    // The sample student's own events are joined by the live ASU feeds when they answer in time, so the
    // sample shows real campus events too, and still works offline.
    const demoUrl = later ? `/api/demo?date=${date}` : "/api/demo";
    const [demo, live] = await Promise.all([
      fetch(demoUrl, { signal: AbortSignal.timeout(REQUEST_LIMIT_MS) }).then((res) =>
        readJson<{ persona: { name: string }; request: PlanRequest }>(res, demoUrl),
      ),
      getJson<unknown>("/api/events", LIVE_EVENTS_WAIT_MS).then(asEvents),
    ]);
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
          .catch((e: unknown) => {
            notice = canvasNotice(e);
            return [] as DayItem[];
          })
      : Promise.resolve([] as DayItem[]),
    getJson<unknown>(`/api/events${eventCampusQuery(setup)}`).then(asEvents),
    getJson<Weather>(weatherUrl(later ? date : undefined, setup.homeCampus)),
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
      startBuildingId: setup.commute ? undefined : setup.startBuildingId,
      homeCampus: setup.homeCampus,
      commute: setup.commute,
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

// Each day as last planned with every pill off, so Sol can explain two or three pills together against it.
const bases = new Map<string, Day>();

const pillsOn = (w: WhatIf) => Number(w.hot) + Number(w.overslept) + Number(w.skipped !== null);
const isPill = (cause: Cause) => cause.kind === "hot" || cause.kind === "overslept" || cause.kind === "skip";

/** The plan without the timeline items the student removed, and a briefing that no longer talks about them. */
function visible(plan: DayPlan, hidden: string[]): DayPlan {
  if (!hidden.length) return plan;
  const gone = plan.items.filter((i) => hidden.includes(itemKey(i)));
  const study = gone.filter((i) => i.type === "study_block").map((i) => i.title);
  return {
    ...plan,
    items: plan.items.filter((i) => !gone.includes(i)),
    briefing: briefingWithout(plan.briefing, study),
  };
}

/** Sol's note when `now` has an event that `old` did not (or lost one), for example one added on Events. */
function eventNote(old: Day, now: Day, hidden: string[]): string {
  const was = (old.loaded.request.acceptedEventIds ?? []).map(asEventItemId);
  const is = (now.loaded.request.acceptedEventIds ?? []).map(asEventItemId);
  const added = is.find((id) => !was.includes(id));
  const removed = was.find((id) => !is.includes(id));
  const cause: Cause | null = added ? { kind: "added", id: added } : removed ? { kind: "removed", id: removed } : null;
  if (!cause) return "";
  return describeChange(cause, visible(old.plan, hidden), visible(now.plan, hidden), {
    now: now.request.now ?? baseNow(now.loaded.request, Date.now()),
    deadlines: now.request.deadlines,
  });
}

/** "Monday" and the day picker's label for `date`, for "I couldn't plan Monday… tap Tomorrow again." */
function dayWords(date: string, today: string) {
  const weekday = formatDay(date).split(",")[0];
  if (date === today) return { day: "today", chip: "Today" };
  return { day: weekday, chip: date === weekDates(today)[1] ? "Tomorrow" : weekday };
}

/** The student's day: today by default, or `date` ("2026-11-16") for a later day. */
export function useDay(date?: string) {
  const [day, setDay] = useState<Day | null>(null); // the day on screen
  const [whatIf, setWhatIfState] = useState<WhatIf>(NO_WHAT_IF); // the pills move at once, the plan follows
  const [change, setChange] = useState(""); // Sol's note on what the last re-plan changed
  const [hidden, setHidden] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState<string | null>(null); // a day that failed to load; it is not "switching"
  const [attempt, setAttempt] = useState(0); // bumped by retry() to load the day again
  const [run] = useState(() => newestWins<DayPlan>());
  const clockNow = useNow();

  // Actions read these refs instead of a past render, so quick actions (a voice command while a button
  // press is still planning) always build on each other.
  const shown = useRef<Day | null>(null); // the day on screen
  const wanted = useRef<Inputs | null>(null); // the newest inputs, possibly still being planned
  const hiddenRef = useRef<string[]>([]);
  const chosen = useRef(""); // the day the page asked for; a late answer for another day is not shown
  const keepError = useRef(""); // after a failed switch, the day we went back to: its reload keeps the red line

  useEffect(() => {
    const today = arizonaToday();
    const wantedDate = date || today;
    chosen.current = wantedDate;
    let active = true;
    // A failed load is not kept in `shared`, so tapping the day again (or retry) really loads it again.
    shared.get(inputKey(wantedDate), () => loadDay(wantedDate, today)).then(
      (loaded) => {
        if (!active) return;
        // The note belongs to the day it was about. Coming back to a day another page changed (an event added on
        // Events), Sol says what that changed instead of keeping an old note.
        const old = shown.current;
        if (old?.plan.date !== loaded.plan.date) setChange("");
        else if (old !== loaded) setChange(eventNote(old, loaded, loadHidden(loaded.plan.date)));
        shown.current = loaded;
        wanted.current = { loaded: loaded.loaded, whatIf: loaded.whatIf };
        hiddenRef.current = loadHidden(loaded.plan.date);
        if (pillsOn(loaded.whatIf) === 0) bases.set(loaded.plan.date, loaded);
        setDay(loaded);
        setWhatIfState(loaded.whatIf);
        setHidden(hiddenRef.current);
        // Back on the day that stayed on screen after a failed switch: keep saying what happened.
        const keep = keepError.current === loaded.plan.date;
        keepError.current = "";
        if (!keep) setError("");
        setFailed(null);
        setBusy(false);
      },
      (e: unknown) => {
        if (!active) return;
        setBusy(false);
        const back = shown.current;
        if (date && back && back.plan.date !== wantedDate) {
          // Switching days failed: the day on screen stays, the picker goes back to it, and tapping the failed
          // day again is a fresh try.
          setError(errorText(e, { doing: "switch", ...dayWords(wantedDate, today) }));
          setFailed(wantedDate);
          keepError.current = back.plan.date;
          // Going back reads the day from `shared`, which forgets it after REUSE_MS and would load it from scratch
          // (pills off, note gone, Gemini asked again). Put the day on screen back first, so it stays as it was.
          shared.set(inputKey(back.plan.date), back);
          replaceChosenDay(back.plan.date);
          return;
        }
        setError(errorText(e, { doing: "first-load" }));
      },
    );
    return () => {
      active = false;
    };
  }, [date, attempt]);

  /** Loads the day again after a failed first load (the "Try again" button). */
  function retry() {
    setError("");
    setBusy(true);
    setAttempt((n) => n + 1);
  }

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
        const base = bases.get(plan.date);
        if (pillsOn(next.whatIf) === 0) bases.set(plan.date, planned);
        shown.current = planned;
        setDay(planned);
        setError("");
        if (cause && before?.plan.date === plan.date) {
          const hidden = hiddenRef.current;
          const now = request.now ?? baseNow(real, Date.now());
          // Two or three pills on: say what the whole stack does to the plain day, not only the last pill.
          const stacked =
            isPill(cause) &&
            pillsOn(next.whatIf) >= 2 &&
            base !== undefined &&
            JSON.stringify(base.loaded.request) === JSON.stringify(real);
          setChange(
            stacked
              ? describeStack(
                  {
                    hotF: next.whatIf.hot ? HOT_PREVIEW.tempF : undefined,
                    wakeAt: next.whatIf.overslept ? request.now : undefined,
                    skipped: next.whatIf.skipped?.course,
                  },
                  visible(base.plan, hidden),
                  visible(plan, hidden),
                  { now },
                )
              : describeChange(cause, visible(before.plan, hidden), visible(plan, hidden), {
                  now,
                  deadlines: request.deadlines,
                }),
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
        setError(errorText(e, { doing: "replan" }));
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

  /**
   * Removes an item from the timeline in this tab, for example a study block. Study time goes per assignment, so
   * a re-plan that moves it keeps it removed. Returns the blocks that left the screen.
   */
  function hide(itemId: string): DayItem[] {
    const current = shown.current;
    const item = current?.plan.items.find((i) => i.id === itemId);
    if (!current || !item) return [];
    const key = itemKey(item);
    if (hiddenRef.current.includes(key)) return [];
    const gone = visible(current.plan, hiddenRef.current).items.filter((i) => itemKey(i) === key);
    hiddenRef.current = [...hiddenRef.current, key];
    saveHidden(current.plan.date, hiddenRef.current);
    setHidden(hiddenRef.current);
    return gone;
  }

  /**
   * Runs a spoken or typed question and returns what Sol says back. Failures are said in plain words. `history`
   * is the chat so far (oldest first), so Sol understands a follow-up.
   */
  async function command(text: string, history: ChatTurn[] = []): Promise<string> {
    const current = shown.current;
    if (!current) return "Your day is still loading.";
    const plan = visible(current.plan, hiddenRef.current);
    // `now` is set for the sample day (it replays 8 am) and while "What if I oversleep?" is on; otherwise a real
    // day uses the server clock.
    const now = current.request.now;
    let action: CommandAction;
    try {
      // The Due soon card's deadlines (with turned-in or not) and the weather, so Sol's answers match the screen.
      action = await postJson<CommandAction>("/api/command", {
        text,
        plan,
        now,
        date: plan.date,
        deadlines: current.request.deadlines,
        weather: plan.weather ?? current.request.weather,
        history: history.slice(-8),
      });
    } catch (e) {
      // No Wi-Fi or Gemini out: what the plan on screen can answer, Sol still answers.
      const local = offlineAnswer(text, plan, now ? Date.parse(now) : Date.now());
      if (local && "remove" in local) return describeRemovedStudy(hide(local.remove.id));
      return local?.reply ?? errorText(e, { doing: "command" });
    }
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
      return `Removed ${item.title} from your day.`;
    }
    const gone = hide(item.id);
    return item.type === "study_block" ? describeRemovedStudy(gone.length ? gone : [item]) : `Removed ${item.title} from your day.`;
  }

  // A different day was picked and is still loading; the previous day stays on screen until it arrives.
  // A day that failed to load is not loading any more.
  const switching = Boolean(date) && day !== null && day.plan.date !== date && failed !== date;

  // The class the "What if … is cancelled?" pill names: while it is on, the one that was cancelled.
  const candidate = day ? skipCandidate(day.loaded.request, day.plan, baseNow(day.loaded.request, clockNow)) : null;
  const skipKey = whatIf.skipped ?? candidate;

  // Same object until the day or the removed items change, so the sky's "Play my day" is not restarted by
  // unrelated re-renders such as the clock tick.
  const plan = useMemo(() => (day ? visible(day.plan, hidden) : null), [day, hidden]);

  return {
    plan,
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
    retry, // new: loads the day again after a failed first load
  };
}
