// Edits to the day by chat: "add gym at 5 for an hour", "I'm skipping MAT 343 today", "put MAT 343 back",
// "move my study time to after CSE 240". Gemini picks the edit; code checks every field (times, lengths, that the
// class exists) before it reaches the browser, and the keyword rules below make the common ones work without it.
import type { CommandAction, DayItem } from "@/lib/types";

export type EditAnswer = { action: string; itemId?: string; title?: string; start?: string; minutes?: number; location?: string; course?: string; time?: string };
type Edit = Extract<CommandAction, { action: "add_block" | "skip_class" | "restore_class" | "study_from" }>;

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const toMinutes = (hhmm: string) => {
  const m = HHMM.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const pad = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** "15:50" from a class's ISO end. */
const hhmmOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Phoenix" });

const sameCourse = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Gemini's edit as an action, when every field checks out; null otherwise (so it is not cached). */
export function toEdit(a: EditAnswer, classes: DayItem[], skipped: string[]): Edit | null {
  if (a.action === "add_block") {
    const title = typeof a.title === "string" ? a.title.trim().slice(0, 60) : "";
    const start = typeof a.start === "string" ? toMinutes(a.start) : null;
    const minutes = typeof a.minutes === "number" && Number.isInteger(a.minutes) ? a.minutes : null;
    if (!title || start === null || minutes === null || minutes < 5 || minutes > 600 || start + minutes > 24 * 60) return null;
    const location = typeof a.location === "string" && a.location.trim() ? a.location.trim().slice(0, 80) : undefined;
    return { action: "add_block", title, start: pad(start), minutes, ...(location ? { location } : {}) };
  }
  if (a.action === "skip_class") {
    const item = classes.find((c) => c.id === a.itemId);
    return item ? { action: "skip_class", course: item.title } : null;
  }
  if (a.action === "restore_class") {
    const course = skipped.find((c) => typeof a.course === "string" && sameCourse(c, a.course));
    return course ? { action: "restore_class", course } : null;
  }
  if (a.action === "study_from") {
    const after = classes.find((c) => c.id === a.itemId); // "after CSE 240": from when it ends
    if (after) return { action: "study_from", time: hhmmOf(after.end ?? after.start) };
    const time = typeof a.time === "string" ? toMinutes(a.time) : null;
    return time === null ? null : { action: "study_from", time: pad(time) };
  }
  return null;
}

const CLOCK = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i;
/** "5" → 17:00 (a bare hour before 8 is the afternoon), "8:30 am" → 08:30, "noon" → 12:00. */
function clockMinutes(text: string): number | null {
  if (/\bnoon\b/i.test(text)) return 12 * 60;
  const m = CLOCK.exec(text);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  const half = m[3]?.toLowerCase().replace(/\./g, "");
  if (half === "pm" && h < 12) h += 12;
  else if (half === "am" && h === 12) h = 0;
  else if (!half && h < 8) h += 12;
  return h * 60 + min;
}

/** The keyword rules for edits, for when Gemini is out. Null when the sentence is not an edit they know. */
export function ruleEdit(text: string, classes: DayItem[], skipped: string[]): Edit | null {
  const t = text.toLowerCase();
  const named = (list: string[]) => list.find((c) => t.includes(c.toLowerCase()));
  // "Put MAT 343 back", "undo skipping MAT 343"
  if (/\b(back|restore|undo|un-?skip)\b/.test(t)) {
    const course = named(skipped);
    if (course) return { action: "restore_class", course };
  }
  // "Move my study time to after CSE 240", "no studying before 2 pm"
  if (/\b(study|studying|homework)\b/.test(t) && /\b(after|from|before|later)\b/.test(t)) {
    const after = classes.find((c) => t.includes(c.title.toLowerCase()));
    if (after && /\bafter\b/.test(t)) return { action: "study_from", time: hhmmOf(after.end ?? after.start) };
    const at = clockMinutes(t.replace(/^.*?\b(after|from|before|later than)\b/, ""));
    if (at !== null) return { action: "study_from", time: pad(at) };
  }
  // "I'm skipping MAT 343 today", "cancel my work shift"
  if (/\b(skip|skipping|not going|won'?t go|cancel|drop|remove|delete)\b/.test(t)) {
    const item = classes.find((c) => t.includes(c.title.toLowerCase()));
    if (item) return { action: "skip_class", course: item.title };
  }
  // "Add gym at 5 for an hour", "put lunch with Sam at 12:30 for 45 minutes"
  const add = /\b(?:add|put|block|schedule)\s+(?:a |an |my )?(.+?)\s+(?:at|from)\s+(noon|\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)(?:\s+for\s+(an?|\d+)\s*(min(?:ute)?s?|h(?:ou)?rs?|hours?))?/i.exec(text);
  if (add) {
    const start = clockMinutes(add[2]);
    const n = add[3] ? (/^an?$/i.test(add[3]) ? 1 : Number(add[3])) : 60;
    const minutes = add[4] && /^h/i.test(add[4]) ? n * 60 : add[3] ? n : 60;
    const title = add[1].replace(/\b(to|on|in)\s+(my|the)\s+(day|calendar|schedule)\b/gi, "").trim();
    if (start !== null && title && minutes >= 5 && minutes <= 600 && start + minutes <= 24 * 60) {
      return { action: "add_block", title: title[0].toUpperCase() + title.slice(1), start: pad(start), minutes };
    }
  }
  return null;
}
