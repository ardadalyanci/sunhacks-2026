// What the setup screen saves in the browser. Nothing here is sent to our server except per request.
import type { ClassBlock } from "@/lib/types";

export interface SavedSetup {
  name: string;
  classes: ClassBlock[];
  interests: string[];
  startBuildingId?: string;
}

const SETUP_KEY = "daypilot.setup";
const TOKEN_KEY = "daypilot.canvasToken"; // sessionStorage: gone when the tab closes

export function loadSetup(): SavedSetup | null {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return null;
    const setup = JSON.parse(raw) as SavedSetup;
    return Array.isArray(setup.classes) && setup.classes.length > 0 ? setup : null;
  } catch {
    return null;
  }
}

export function saveSetup(setup: SavedSetup, token: string) {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked (private mode): the sample day still works
  }
}

export function clearSetup() {
  try {
    localStorage.removeItem(SETUP_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // nothing to clear
  }
}

const ACCEPTED_KEY = "daypilot.accepted"; // events the student added, shared by Today and Events

export function loadAccepted(): string[] {
  try {
    const ids = JSON.parse(sessionStorage.getItem(ACCEPTED_KEY) ?? "[]") as unknown;
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveAccepted(ids: string[]) {
  try {
    sessionStorage.setItem(ACCEPTED_KEY, JSON.stringify(ids));
  } catch {
    // storage blocked: the choice lasts until the page reloads
  }
}

export function loadToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
