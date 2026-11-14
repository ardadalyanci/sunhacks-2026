"use client";

// The screens' one source of truth: POST /api/day through fetchDay() (lib/api-client.ts).
// No saved setup → the server answers with the sample day. Events the student adds are kept in this tab
// (sessionStorage) so Today and Events agree; study blocks they remove are hidden on this page only.
import { useEffect, useState } from "react";
import { fetchDay, readCanvasToken, readSetup, type DayResponse } from "@/lib/api-client";
import type { CommandResult, DayPlan } from "@/lib/types";
import { runCommand } from "./commands";

const ACCEPTED_KEY = "daypilot.accepted";

function loadAccepted(): string[] {
  try {
    const ids = JSON.parse(window.sessionStorage.getItem(ACCEPTED_KEY) ?? "[]") as unknown;
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveAccepted(ids: string[]) {
  try {
    window.sessionStorage.setItem(ACCEPTED_KEY, JSON.stringify(ids));
  } catch {
    // storage blocked: the choice lasts until the page reloads
  }
}

function load(acceptedEventIds: string[], previewHot: boolean) {
  return fetchDay({ setup: readSetup(), canvasToken: readCanvasToken(), acceptedEventIds, previewHot });
}

function arizonaHours() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") + get("minute") / 60;
}

/** Event items on the timeline carry the CampusEvent id with an "event-" prefix. */
const eventIdOf = (itemId: string) => itemId.replace(/^event-/, "");

export function useDay() {
  const [data, setData] = useState<DayResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [hot, setHot] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const initial = loadAccepted();
    (async () => {
      try {
        const first = await load(initial, false);
        if (cancelled) return;
        setAccepted(initial);
        setData(first);
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

  async function refresh(nextAccepted: string[], previewHot: boolean) {
    setBusy(true);
    try {
      setData(await load(nextAccepted, previewHot));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function setHotPreview(value: boolean) {
    setHot(value);
    await refresh(accepted, value);
  }

  async function addEvent(eventId: string) {
    const id = eventIdOf(eventId);
    if (accepted.includes(id)) return;
    const next = [...accepted, id];
    setAccepted(next);
    saveAccepted(next);
    await refresh(next, hot);
  }

  async function removeEvent(eventId: string) {
    const id = eventIdOf(eventId);
    const next = accepted.filter((x) => x !== id);
    setAccepted(next);
    saveAccepted(next);
    await refresh(next, hot);
  }

  function hide(itemId: string) {
    setHidden((prev) => [...prev, itemId]);
  }

  const plan: DayPlan | null = data
    ? { ...data.plan, items: data.plan.items.filter((i) => !hidden.includes(i.id)) }
    : null;

  /** Runs a spoken or typed command through /api/command and applies what it asks for. */
  async function command(transcript: string): Promise<CommandResult> {
    if (!plan || !data) return { action: "none", say: "Your day is still loading." };
    const result = await runCommand(transcript, {
      briefing: plan.briefing,
      items: plan.items,
      picks: data.picks,
      nowHours: arizonaHours(),
      now: new Date().toISOString(),
    });
    if (result.action === "add_event" && result.id) await addEvent(result.id);
    if (result.action === "remove_item" && result.id) {
      const item = plan.items.find((i) => i.id === result.id);
      if (item?.kind === "event") await removeEvent(item.id);
      else hide(result.id);
    }
    return result;
  }

  return { data, plan, error, busy, hot, accepted, setHotPreview, addEvent, removeEvent, hide, command };
}
