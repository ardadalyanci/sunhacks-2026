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

export function useChosenDay() {
  const today = useSyncExternalStore(noUpdates, readToday, onServer);
  const hash = useSyncExternalStore(onHashChange, readHash, onServer);
  const days = today ? weekDates(today) : [];
  return { today, days, date: days.includes(hash) ? hash : today };
}
