"use client";

// Loads the student's day from the backend routes and keeps it in sync with what they add or remove.
// No saved setup → the sample day from GET /api/demo (works with no token, feeds or Wi-Fi).
// Saved setup → POST /api/canvas (if a token is saved) + GET /api/events + GET /api/weather → POST /api/plan.
import { useCallback, useEffect, useState } from "react";
import type { CommandAction, DayItem, DayPlan, Opportunity, PlanRequest, Weather } from "@/lib/types";
import { loadAccepted, loadSetup, loadToken, saveAccepted } from "./setup-store";
import { formatTime, parseLocal } from "./time";

const HOT_PREVIEW: Weather = { tempF: 104, highF: 109, isHot: true };

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

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function asEvents(value: unknown): Opportunity[] {
  if (Array.isArray(value)) return value as Opportunity[];
  const events = (value as { events?: unknown } | null)?.events;
  return Array.isArray(events) ? (events as Opportunity[]) : [];
}

const asEventItemId = (id: string) => (id.startsWith("ev-") ? id : `ev-${id}`);

type Loaded = { request: PlanRequest; name: string; isDemo: boolean; notice: string };

async function buildRequest(hot: boolean): Promise<Loaded> {
  const setup = loadSetup();
  if (!setup) {
    const demo = await getJson<{ persona: { name: string }; request: PlanRequest }>(`/api/demo${hot ? "?hot=1" : ""}`);
    if (!demo) throw new Error("The sample day did not load. Check that the app server is running.");
    return {
      request: { ...demo.request, acceptedEventIds: loadAccepted() },
      name: demo.persona.name,
      isDemo: true,
      notice: "",
    };
  }

  let notice = "";
  const token = loadToken();
  const [deadlines, events, weather] = await Promise.all([
    token
      ? postJson<{ deadlines: DayItem[] }>("/api/canvas", { token })
          .then((r) => r.deadlines)
          .catch((e: Error) => {
            notice = `Canvas did not load: ${e.message} Your classes and events are still here.`;
            return [] as DayItem[];
          })
      : Promise.resolve([] as DayItem[]),
    getJson<unknown>("/api/events").then(asEvents),
    getJson<Weather>("/api/weather"),
  ]);
  if (!token) notice = "Add your Canvas token in Setup to see your assignments here.";

  return {
    request: {
      classes: setup.classes,
      deadlines,
      events,
      acceptedEventIds: loadAccepted(),
      interests: setup.interests,
      weather: hot ? HOT_PREVIEW : (weather ?? undefined),
      startBuildingId: setup.startBuildingId,
    },
    name: setup.name,
    isDemo: false,
    notice,
  };
}

export function useDay() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [hot, setHot] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]); // study blocks the student removed

  const replan = useCallback(async (request: PlanRequest) => {
    const next = await postJson<DayPlan>("/api/plan", request);
    setPlan(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const built = await buildRequest(false);
        const first = await postJson<DayPlan>("/api/plan", built.request);
        if (cancelled) return;
        setLoaded(built);
        setPlan(first);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function setHotPreview(value: boolean) {
    setHot(value);
    await run(async () => {
      const built = await buildRequest(value);
      built.request.acceptedEventIds = loaded?.request.acceptedEventIds ?? [];
      setLoaded(built);
      await replan(built.request);
    });
  }

  async function setAccepted(ids: string[]) {
    if (!loaded) return;
    saveAccepted(ids);
    const request = { ...loaded.request, acceptedEventIds: ids };
    setLoaded({ ...loaded, request });
    await replan(request);
  }

  async function accept(itemId: string) {
    const current = loaded?.request.acceptedEventIds ?? [];
    const id = asEventItemId(itemId);
    if (current.map(asEventItemId).includes(id)) return;
    await run(() => setAccepted([...current, id]));
  }

  async function unaccept(itemId: string) {
    const id = asEventItemId(itemId);
    await run(() => setAccepted((loaded?.request.acceptedEventIds ?? []).filter((x) => asEventItemId(x) !== id)));
  }

  function hide(itemId: string) {
    setHidden((prev) => [...prev, itemId]);
  }

  const visiblePlan: DayPlan | null = plan ? { ...plan, items: plan.items.filter((i) => !hidden.includes(i.id)) } : null;

  /** Runs a spoken or typed command and returns what DayPilot should say back. */
  async function command(text: string): Promise<string> {
    if (!visiblePlan) return "Your day is still loading.";
    const action = await postJson<CommandAction>("/api/command", { text, plan: visiblePlan });
    if (action.action === "briefing") return visiblePlan.briefing;
    if (action.action === "unknown") return action.reply;
    if (action.action === "add_event") {
      const item = visiblePlan.suggestions.find((s) => s.id === action.itemId);
      await accept(action.itemId);
      return item ? `Added ${item.title} at ${formatTime(parseLocal(item.start).hours)}.` : "Added it to your day.";
    }
    const item = visiblePlan.items.find((i) => i.id === action.itemId);
    if (item?.type === "event") await unaccept(item.id);
    else hide(action.itemId);
    return item ? `Removed ${item.title} from your day.` : "Removed it.";
  }

  return {
    plan: visiblePlan,
    request: loaded?.request ?? null,
    name: loaded?.name ?? "",
    isDemo: loaded?.isDemo ?? true,
    notice: loaded?.notice ?? "",
    error,
    busy,
    hot,
    setHotPreview,
    accept,
    unaccept,
    hide,
    command,
  };
}
