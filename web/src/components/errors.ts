// Turns a failed request into words a student understands. No React here, so the rules are easy to test.
// The raw error ("Failed to fetch", "Request to /api/plan failed (500).") never reaches the screen.
import type { DayItem, DayPlan } from "@/lib/types";
import { MASCOT } from "./brand";
import { nextWalk, placeLabel } from "./next-walk";
import { formatTime, parseLocal } from "./time";

/** A route answered with an error status; `message` is the route's own `error` text, when it sent one. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type ErrorKind = "offline" | "timeout" | "server" | "other";

/** What kind of failure `e` is: no connection, too slow, our server (or Gemini behind it) failing, or anything else. */
export function errorKind(e: unknown): ErrorKind {
  const name = (e as { name?: unknown } | null)?.name;
  if (name === "TimeoutError") return "timeout"; // AbortSignal.timeout fired
  if (e instanceof HttpError) return e.status >= 500 ? "server" : "other";
  if (e instanceof TypeError || name === "AbortError") return "offline"; // fetch() rejects with a TypeError offline
  return "other";
}

/** What the student was doing when it failed. */
export type FailedWhile =
  | { doing: "first-load" }
  | { doing: "switch"; day: string; chip: string } // day: "Monday" or "tomorrow"; chip: the picker label to tap
  | { doing: "replan" }
  | { doing: "command" };

const TOO_SLOW = `${MASCOT} took too long. Try again.`;

/** One or two plain sentences for the red line, or for Sol's reply to a typed or spoken question. */
export function errorText(e: unknown, context: FailedWhile): string {
  const kind = errorKind(e);
  switch (context.doing) {
    case "first-load":
      if (kind === "offline") return "No connection right now. Check the Wi-Fi and try again.";
      if (kind === "timeout") return TOO_SLOW;
      return "I couldn't plan your day just now. Try again in a moment.";
    case "switch":
      if (kind === "offline") return `I couldn't plan ${context.day}. Check the Wi-Fi and tap ${context.chip} again.`;
      if (kind === "timeout") return `${MASCOT} took too long to plan ${context.day}. Tap ${context.chip} again.`;
      return `I couldn't plan ${context.day} just now. Tap ${context.chip} again in a moment.`;
    case "replan":
      if (kind === "offline") {
        return "No connection right now. Your day is still here, so try that again when you're back online.";
      }
      if (kind === "timeout") return TOO_SLOW;
      return "I couldn't re-plan just now. Try again in a moment.";
    case "command":
      if (kind === "offline") return "I can't reach the internet right now. Try again when you're back online.";
      if (kind === "timeout") return "That took me too long. Try again.";
      return "I couldn't do that right now. Try again in a moment.";
  }
}

/** The notice when Canvas fails: the route's own words for a token problem (4xx), plain words for the rest. */
export function canvasNotice(e: unknown): string {
  if (e instanceof HttpError && e.status >= 400 && e.status < 500 && e.message) {
    return `${e.message.replace(/\.?$/, ".")} Your classes and events are still here.`;
  }
  return "Canvas did not load, so assignments are missing. Your classes and events are still here.";
}

const clock = (iso: string) => formatTime(parseLocal(iso).hours);

/**
 * What Sol can still answer when /api/command fails (no Wi-Fi, Gemini out): "what's next?" and "when should I
 * leave?" from the plan on screen, and "drop the study block" as a removal. Null for anything else.
 */
export function offlineAnswer(
  text: string,
  plan: DayPlan,
  nowMs: number,
): { reply: string } | { remove: DayItem } | null {
  if (/\b(drop|remove|skip|delete|cancel)\b/i.test(text) && /\bstudy/i.test(text)) {
    const block = plan.items.find((i) => i.type === "study_block" && Date.parse(i.end ?? i.start) > nowMs);
    return block ? { remove: block } : { reply: "There's no study block left on your day." };
  }
  if (/\b(next|leave|go|going|head)\b/i.test(text)) {
    const walk = nextWalk(plan.items, nowMs);
    if (!walk?.item.leaveAt) return { reply: "You're done walking for today." };
    const place = placeLabel(walk.item.location) || walk.item.title;
    const leave = walk.now ? "Leave now" : `Leave at ${clock(walk.item.leaveAt)}`;
    return { reply: `Next is ${walk.item.title} at ${clock(walk.item.start)}. ${leave} for ${place}.` };
  }
  return null;
}
