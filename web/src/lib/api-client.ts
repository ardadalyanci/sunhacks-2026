// Browser helpers for the screens: one call for the whole day, plus the setup/token storage the setup page
// already uses. Everything here speaks the public types in ./types.ts.
//
//   const day = await fetchDay({ setup: readSetup(), canvasToken: readCanvasToken(), acceptedEventIds });
//   day.plan, day.dueSoon, day.picks, day.setup   // replaces demoPlan, demoDueSoon, demoPicks, demoSetup
//
// With no saved setup (or demo: true, or the token "demo") the server answers with the offline demo day.
import type { DayItem, DayPlan, EventPick, StudentSetup } from "./types";

export const SETUP_KEY = "daypilot.setup"; // localStorage, written by the setup page
export const TOKEN_KEY = "daypilot.canvasToken"; // sessionStorage, written by the setup page

export interface DayRequest {
  setup?: StudentSetup | null;
  canvasToken?: string | null;
  demo?: boolean;
  date?: string; // "YYYY-MM-DD", default today in Arizona
  now?: string; // ISO; default 8 AM for the demo, the real time otherwise
  acceptedEventIds?: string[]; // CampusEvent ids the student added (from Events, "Add to my day" or voice)
  previewHot?: boolean; // the "Preview a hot day" toggle
}

export interface DayResponse {
  demo: boolean; // true when the answer is the sample day (show a small "Demo data" label)
  setup: StudentSetup;
  plan: DayPlan;
  dueSoon: DayItem[]; // assignments due after today
  picks: EventPick[]; // today's picks first, then later this week
}

export async function fetchDay(request: DayRequest, init?: { signal?: AbortSignal }): Promise<DayResponse> {
  const res = await fetch("/api/day", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, setup: request.setup ?? undefined, canvasToken: request.canvasToken ?? undefined }),
    signal: init?.signal,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? `DayPilot could not plan the day (${res.status}).`);
  return json as DayResponse;
}

export function readSetup(): StudentSetup | null {
  try {
    const raw = window.localStorage.getItem(SETUP_KEY);
    return raw ? (JSON.parse(raw) as StudentSetup) : null;
  } catch {
    return null;
  }
}

export function readCanvasToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
