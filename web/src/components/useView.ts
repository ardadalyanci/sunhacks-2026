"use client";

// Whether Today shows the sky timeline or the plain list. The choice is remembered in this browser, so a
// student who needs the list (zoom, low vision, a screen reader) does not have to pick it every day.
import { useSyncExternalStore } from "react";

export type DayView = "sky" | "list";

const KEY = "daypilot.view";
const listeners = new Set<() => void>();
let fallback: DayView = "sky"; // used when storage is blocked: the choice lasts until the page reloads

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

function read(): DayView {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "list" || saved === "sky" ? saved : fallback;
  } catch {
    return fallback;
  }
}

const onServer = (): DayView => "sky"; // the server render has no storage; the browser fills it in

export function useView(): [DayView, (next: DayView) => void] {
  const view = useSyncExternalStore(subscribe, read, onServer);
  function setView(next: DayView) {
    fallback = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: `fallback` keeps the choice for this visit
    }
    listeners.forEach((notify) => notify());
  }
  return [view, setView];
}
