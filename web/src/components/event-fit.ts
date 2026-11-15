// How an event sits in the student's day, and its listing text cleaned up. No React here.
import type { DayItem, Opportunity } from "@/lib/types";

/** A club's own blurb without emoji, on one line, cut at a word near `max` characters. */
export function cleanDescription(text: string, max = 220): string {
  const plain = text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[,.;:!?-]+$/, "")}…`;
}

/**
 * Whether an event on the plan's day fits around the student's classes and events (from the time they leave
 * to the time they finish), or the first thing it clashes with.
 */
export function fitOnDay(event: Opportunity, items: DayItem[]): { fits: true } | { fits: false; clash: DayItem } {
  const start = Date.parse(event.startsAt ?? "");
  const end = Date.parse(event.endsAt ?? event.startsAt ?? "");
  const clash = items.find(
    (i) =>
      (i.type === "class" || i.type === "event") &&
      i.id !== `ev-${event.id}` &&
      Date.parse(i.leaveAt ?? i.start) < end &&
      start < Date.parse(i.end ?? i.start),
  );
  return clash ? { fits: false, clash } : { fits: true };
}
