"use client";

// The current time for countdowns ("Leave in 23 min"), ticking every 20 seconds while a page shows it.
import { useSyncExternalStore } from "react";

let now = Date.now();

function subscribe(notify: () => void) {
  now = Date.now();
  const timer = setInterval(() => {
    now = Date.now();
    notify();
  }, 20_000);
  return () => clearInterval(timer);
}

const read = () => now;
const onServer = () => 0; // the server render has no clock; the browser fills it in

export function useNow(): number {
  return useSyncExternalStore(subscribe, read, onServer);
}
