import type { CommandResult, DayItem, EventPick } from "@/lib/types";
import { formatTime, parseLocal } from "./time";

export type CommandContext = {
  briefing: string;
  items: DayItem[];
  picks: EventPick[];
  nowHours: number; // local time of day, e.g. 13.5
  now?: string; // ISO, so "what's next" uses the real time
};

/** Asks A's /api/command route; falls back to simple matching in the browser if the route is unreachable. */
export async function runCommand(transcript: string, ctx: CommandContext): Promise<CommandResult> {
  try {
    const res = await fetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        items: ctx.items,
        picks: ctx.picks.map((p) => p.event),
        briefing: ctx.briefing,
        now: ctx.now,
      }),
    });
    if (res.ok) return (await res.json()) as CommandResult;
  } catch {
    // network error: use the local fallback below
  }
  return localCommand(transcript, ctx);
}

export function localCommand(transcript: string, ctx: CommandContext): CommandResult {
  const text = transcript.toLowerCase();

  if (/how('s| is) my day|brief|my day|today/.test(text)) {
    return { action: "briefing", say: ctx.briefing };
  }

  if (/next|what now|where/.test(text)) {
    const next = ctx.items.find((i) => i.startsAt && parseLocal(i.startsAt).hours >= ctx.nowHours);
    if (!next?.startsAt) return { action: "next_item", say: "Nothing else is planned today." };
    return {
      action: "next_item",
      id: next.id,
      say: `Next: ${next.title} at ${formatTime(parseLocal(next.startsAt).hours)}.`,
    };
  }

  const add = text.match(/add (?:the )?(.+)/);
  if (add) {
    const words = add[1].split(/\s+/).filter((w) => w.length > 2);
    const pick = ctx.picks.find((p) => words.some((w) => p.event.title.toLowerCase().includes(w)));
    if (pick) {
      return {
        action: "add_event",
        id: pick.event.id,
        say: `Added ${pick.event.title} at ${formatTime(parseLocal(pick.event.startsAt).hours)}.`,
      };
    }
    return { action: "none", say: "I could not find that event. Try its name, like robotics." };
  }

  return {
    action: "none",
    say: "I can read your day, tell you what is next, or add an event. Try: add the robotics meeting.",
  };
}
