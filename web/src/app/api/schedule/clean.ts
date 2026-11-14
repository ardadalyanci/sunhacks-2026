import type { ClassBlock, Weekday } from "@/lib/types";

export const DAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Keeps only well-formed classes; never trusts the model's output shape. */
export function cleanClasses(raw: unknown): ClassBlock[] {
  if (!Array.isArray(raw)) return [];
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  return raw
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => {
      const location = String(c.location ?? "").trim().slice(0, 40);
      const block: ClassBlock = {
        course: String(c.course ?? "").trim().slice(0, 20),
        days: (Array.isArray(c.days) ? c.days : []).filter((d): d is Weekday => DAYS.includes(d as Weekday)),
        start: String(c.start ?? ""),
        end: String(c.end ?? ""),
      };
      if (location) block.location = location;
      return block;
    })
    .filter((c) => c.course && c.days.length && time.test(c.start) && time.test(c.end) && c.start < c.end)
    .slice(0, 20);
}
