"use client";

// The day the Today screen shows: today, or one of the next six days picked in the day picker.
// The choice lives in the URL hash (#2026-11-16), so a reload or a shared link keeps it.
import { useSyncExternalStore } from "react";
import { arizonaToday, weekDates } from "./time";

function onHashChange(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}
const noUpdates = () => () => {};
const readHash = () => window.location.hash.slice(1);
const readToday = () => arizonaToday();
const onServer = () => ""; // the server render has no clock or hash; the browser fills them in

/**
 * Puts `date` back in the URL without a new history entry, for example after another day failed to load, so the
 * day picker marks the day that is on screen and tapping the failed day again is a real retry.
 */
export function replaceChosenDay(date: string) {
  const hash = date === arizonaToday() ? "#today" : `#${date}`;
  if (window.location.hash === hash) return;
  window.history.replaceState(null, "", hash);
  window.dispatchEvent(new HashChangeEvent("hashchange")); // replaceState fires no event of its own
}

export function useChosenDay() {
  const today = useSyncExternalStore(noUpdates, readToday, onServer);
  const hash = useSyncExternalStore(onHashChange, readHash, onServer);
  const days = today ? weekDates(today) : [];
  return { today, days, date: days.includes(hash) ? hash : today };
}
