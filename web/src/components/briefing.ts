// Sol's briefing once the student has taken study time off the day. The briefing was written for the whole plan,
// so it may still say "I saved 8 am to work on Lab 7". No React here, so the rule is easy to test.
import { assignmentName } from "./sky-layout";

/** "Lab 7" for "Work on: CSE 230: Lab 7 (pipelining)", plus the long form a sentence may use ("Homework 9"). */
function namesFor(blockTitle: string): string[] {
  const title = blockTitle.replace(/^Work on:\s*/, "");
  const short = assignmentName(title);
  const long = title
    .replace(/^[A-Z]{2,4} \d{3}[A-Z]?:\s*/, "")
    .replace(/\s*\([^)]*\)/g, "")
    .trim();
  return [...new Set([short, long].filter(Boolean))];
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when `sentence` names `name` as a whole word ("Lab 7" but not "Lab 70"), in any case. */
const names = (sentence: string, name: string) => new RegExp(`(?<!\\w)${escape(name)}(?!\\w)`, "i").test(sentence);

/** "Leave at 10:18 am." from "Then leave at 10:18 am.": a sentence whose lead-in pointed at a removed one. */
function standAlone(sentence: string): string {
  const rest = sentence.replace(/^(then|after that|afterwards|next|and|also|plus),?\s+/i, "");
  return rest === sentence ? sentence : rest.charAt(0).toUpperCase() + rest.slice(1);
}

const list = (words: string[]) =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

// Words of a sentence about working on an assignment ("I saved 8 am to work on Lab 7").
const STUDY = /\b(study|studying|work on|working on|saved|block|start|tackle|focus)\b/i;

/** A sentence that only says when the assignment is due ("Lab 7 for CSE 230 is due at 11:59 pm") stays true. */
const onlyDue = (sentence: string) => /\bdue\b/i.test(sentence) && !STUDY.test(sentence);

/**
 * `briefing` without the sentences about study time the student removed (`removed` holds the removed blocks'
 * titles): every sentence that names one of those assignments, unless it only says when it is due. When nothing
 * is left, Sol says what happened: "You took the Lab 7 study time off your day."
 */
export function briefingWithout(briefing: string, removed: string[]): string {
  const titles = [...new Set(removed)];
  if (!titles.length) return briefing;
  const gone = titles.map(namesFor);
  // A new sentence starts after . ? or ! and a space, before a capital letter or a quote (not inside "8 a.m. on").
  const sentences = briefing.split(/(?<=[.?!])\s+(?=[A-Z"“‘'])/).filter((s) => s.trim());
  const keep = sentences.map((s) => onlyDue(s) || !gone.some((variants) => variants.some((name) => names(s, name))));
  if (keep.every(Boolean)) return briefing;
  // "Then leave at 10:18 am…" leaned on the sentence before it; when that one went, the "Then" goes too.
  const kept = sentences.flatMap((s, i) => (!keep[i] ? [] : i > 0 && !keep[i - 1] ? [standAlone(s)] : [s]));
  if (kept.length) return kept.join(" ");
  return `You took the ${list(gone.map((variants) => variants[0]))} study time off your day.`;
}
