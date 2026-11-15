// POST /api/command  { text: string, plan: DayPlan, now?: ISO }  →  CommandAction
// Turns what the student said into one action on the current plan:
//   "How's my day?"            → { action: "briefing" }            (UI speaks plan.briefing)
//   "What's next?" / "When do I leave?" → { action: "briefing", reply: "Next up: CSE 230 at 10:30 am in Brickyard 210. Leave at 10:20 am." }
//                                (code finds the next stop after `now`, default the server clock; UI speaks reply)
//   "Add the robotics meeting" → { action: "add_event", itemId }   (UI re-calls /api/plan with the id in acceptedEventIds)
//   "Drop the study block"     → { action: "remove_item", itemId }
// Gemini understands the sentence; simple keyword rules take over when Gemini is unavailable.
import { generateJson } from "@/lib/gemini";
import { polishLine } from "@/lib/places";
import { clock, hasPhrase } from "@/lib/planner";
import { sanitizePlanForCommand } from "@/lib/sanitize";
import { dayOpener, spokenEvent, spokenItem, spokenWhere } from "@/lib/say";
import type { CommandAction, DayItem } from "@/lib/types";

/** "Drop the study block", "the study time, skip it": a removal that names a study block, in either order. */
const isStudyRemoval = (text: string) => /\b(remove|drop|cancel|skip|delete)\b/i.test(text) && /\bstudy (block|time|session)s?\b/i.test(text);

const STOPWORDS = new Set(["the", "a", "an", "to", "my", "me", "please", "add", "remove", "drop", "cancel", "skip", "join", "meeting", "event", "club", "from", "for", "and", "of", "on", "at", "in"]);

export async function POST(request: Request) {
  let body: { text?: unknown; plan?: unknown; now?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON: { text, plan }." }, { status: 400 });
  }
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 300) : "";
  if (!text) return Response.json({ error: "`text` is required." }, { status: 400 });

  const plan = sanitizePlanForCommand(body?.plan);
  const addable = plan.suggestions;
  const removable = plan.items.filter((i) => i.type === "event" || i.type === "study_block");

  const nowMs = typeof body?.now === "string" && !Number.isNaN(Date.parse(body.now)) ? Date.parse(body.now) : Date.now();

  // "Drop the study block" is answered by the keyword rule, with no Gemini call: Gemini sees study blocks only as
  // "Work on: …" titles and sometimes answers that there is none (and that answer gets cached). Only when the
  // student names a study block, time or session, so "cancel the study group" (a commitment) still goes to Gemini.
  const quick = isStudyRemoval(text) ? byRules(text, addable, removable) : null;
  const decision =
    (quick?.action === "remove_item" ? quick : null) ?? (await understand(text, addable, removable)) ?? byRules(text, addable, removable);
  const action: CommandAction =
    decision.action === "next_item" ? { action: "briefing", reply: polishLine(nextReply(plan.items, nowMs, text)) } : decision;
  return Response.json(action);
}

/** Marker for "what's next / when do I leave": answered from the plan by code, not by Gemini. */
const NEXT = { action: "next_item" } as const;
type Decision = CommandAction | typeof NEXT;

/** Questions about the walk itself ("when should I leave", "am I late") lead with the next leave time. */
const LEAVE_WORDS = /\b(leave|leaving|head out|walk|late)\b/i;

/**
 * "What's next / when do I leave": the next class, event or study block after `nowMs`, and the next walk, named
 * the way Sol names them everywhere else ("your work shift at the MU", "the Reading response for ENG 102").
 * A leave question names the walk first, even when a study block comes before it ("Until then, you're on …").
 * When the next thing is on a later day (a look-ahead), the reply says which day.
 */
function nextReply(items: DayItem[], nowMs: number, text: string): string {
  const upcoming = items
    .filter((i) => (i.type === "class" || i.type === "event" || i.type === "study_block") && Date.parse(i.start) > nowMs)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const next = upcoming[0];
  if (!next) return "Nothing else is planned today.";
  const walk = upcoming.find((i) => i.leaveAt); // the next stop the student walks to
  const opener = dayOpener(next.start, nowMs); // "Tomorrow" / "On Tuesday", or null for today
  const leave = (leaveAt: string) => (Date.parse(leaveAt) <= nowMs ? "leave now" : `leave at ${clock(leaveAt)}`);
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  const begin = (sentence: string) => (opener ? `${opener}, ${sentence}` : cap(sentence));

  if (walk?.leaveAt && LEAVE_WORDS.test(text)) {
    const minutes = Math.max(1, Math.round((Date.parse(walk.start) - Date.parse(walk.leaveAt)) / 60_000));
    const line = begin(`${leave(walk.leaveAt)} for ${spokenItem(walk)}${spokenWhere(walk)}, a ${minutes}-minute walk.`);
    if (walk === next) return line;
    const doing = next.type === "study_block" ? "you're on" : "you have";
    return `${line} Until then, ${doing} ${spokenItem(next)} at ${clock(next.start)}.`;
  }
  const head = `${opener ? `${opener}, first up is` : "Next up:"} ${spokenItem(next)} at ${clock(next.start)}${spokenWhere(next)}.`;
  if (next.leaveAt) return `${head} ${cap(leave(next.leaveAt))}.`;
  if (!walk?.leaveAt) return head;
  return `${head} Then ${leave(walk.leaveAt)} for ${spokenItem(walk)}${spokenWhere(walk)}.`;
}

async function understand(text: string, addable: DayItem[], removable: DayItem[]): Promise<Decision | null> {
  const prompt = [
    "A student talks to their day-planner app. Map what they said to exactly one action.",
    '- "briefing": they ask about their whole day or schedule.',
    '- "next_item": they ask what is next, where to go now, or when to leave.',
    '- "add_event": they want one of ADDABLE on their day. itemId must be an id from ADDABLE.',
    '- "remove_item": they want one of REMOVABLE off their day. itemId must be an id from REMOVABLE.',
    '- "unknown": anything else. Put a short reply (max 25 words) in "reply", speaking as the app\'s sun mascot Sol ("I"). Never ask a question back: the student cannot answer it. If they wanted to add something and nothing in ADDABLE matches, say you couldn\'t find it today and name what you can add, like "I couldn\'t find a robotics meeting today. I can add the hackathon team mixer or the lunch & learn."',
    // "Should I go to the lunch talk?" is a question about one of Sol's picks: a straight answer, not "I'm not sure".
    '  If they ask whether to go to something in ADDABLE, answer "Yes" first, then one reason from its "why", title or time, then how to add it, like "Yes: it\'s at noon and it\'s about software internships. Say add the lunch & learn." Never say you are not sure.',
    `ADDABLE: ${JSON.stringify(addable.map((a) => ({ id: a.id, title: a.title, ...(a.start ? { time: clock(a.start) } : {}), ...(a.why ? { why: a.why } : {}) })))}`,
    `REMOVABLE: ${JSON.stringify(removable.map((r) => ({ id: r.id, title: r.title })))}`,
    `Student said: ${JSON.stringify(text)}`,
  ].join("\n");
  type Answer = { action: string; itemId?: string; reply?: string };
  // Only answers that name an action and, for add/remove, an id we actually offered count (and get cached).
  // A reply that asks a question back is a dead end (nothing can answer it), so the keyword rules answer instead.
  const isValid = (v: unknown): boolean => {
    const a = v as Answer;
    if (a?.action === "unknown") return typeof a.reply !== "string" || !a.reply.includes("?");
    if (a?.action === "briefing" || a?.action === "next_item") return true;
    if (a?.action === "add_event") return addable.some((x) => x.id === a.itemId);
    if (a?.action === "remove_item") return removable.some((x) => x.id === a.itemId);
    return false;
  };
  const result = await generateJson<Answer>(
    prompt,
    {
      type: "object",
      properties: {
        action: { type: "string", enum: ["briefing", "next_item", "add_event", "remove_item", "unknown"] },
        itemId: { type: "string" },
        reply: { type: "string" },
      },
      required: ["action"],
    },
    isValid,
  );
  if (!result) return null;
  if (result.action === "briefing") return { action: "briefing" };
  if (result.action === "next_item") return NEXT;
  if (result.action === "add_event") return { action: "add_event", itemId: result.itemId! };
  if (result.action === "remove_item") return { action: "remove_item", itemId: result.itemId! };
  return { action: "unknown", reply: (typeof result.reply === "string" && result.reply.trim().slice(0, 200)) || help(addable) };
}

const ADD_WORDS = /\b(add|join|go to|sign me up(?: for)?|put|attend)\b/;

function byRules(text: string, addable: DayItem[], removable: DayItem[]): Decision {
  // Phones type curly apostrophes ("How’s my day?"); the rules below expect straight ones.
  const t = text.toLowerCase().replace(/[‘’ʼ]/g, "'");
  if (/\b(next|what now|where (do|should) i (go|be)|when (do|should) i (leave|go|head out)|head out|am i late|my walk)\b/.test(t)) return NEXT;
  if (/(how'?s|how is|what'?s|what is).*(day|today|schedule|next)|brief/.test(t)) return { action: "briefing" };
  if (/\b(remove|drop|cancel|skip|delete)\b/.test(t)) {
    const hit = bestMatch(t, removable);
    if (hit) return { action: "remove_item", itemId: hit.id };
  }
  if (ADD_WORDS.test(t)) {
    const hit = bestMatch(t, addable);
    if (hit) return { action: "add_event", itemId: hit.id };
    return { action: "unknown", reply: notFound(t, addable) };
  }
  return { action: "unknown", reply: help(addable) };
}

/** What Sol can do, with a real example from today's picks when there is one. Never a question back. */
function help(addable: DayItem[]): string {
  const example = addable[0] ? `"add ${spokenEvent(addable[0].title)}"` : '"what\'s next?"';
  return `I can tell you how your day looks, when to leave, or ${addable[0] ? "add an event, like " : "answer "}${example}.`;
}

/** "I couldn't find a robotics meeting today. I can add the hackathon team mixer or the lunch & learn." */
function notFound(said: string, addable: DayItem[]): string {
  const asked = said
    .replace(/^.*?\b(add|join|go to|sign me up(?: for)?|put|attend)\b\s*/, "")
    .replace(/\b(to|on|in)\s+(my|the)\s+(day|calendar|schedule|timeline)\b|\b(today|tonight|please)\b/g, "")
    .replace(/[^a-z0-9&' -]+/g, " ")
    .replace(/^\s*(the|a|an|my|that)\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  const missing = asked ? `${/^[aeiou]/.test(asked) ? "an" : "a"} ${asked}` : "that";
  const names = addable.slice(0, 3).map((a) => spokenEvent(a.title));
  const offer = names.length
    ? ` I can add ${names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : names[0]}.`
    : " No other event fits your free time.";
  return `I couldn't find ${missing} today.${offer}`;
}

/** The item whose title shares the most meaningful words with what was said. */
function bestMatch(said: string, items: DayItem[]): DayItem | undefined {
  const words = said.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  let best: { item: DayItem; score: number } | undefined;
  for (const item of items) {
    // Study blocks are titled "Work on: <assignment>", so "study" and "block" also name them.
    const title = `${item.title} ${item.type === "study_block" ? "study block" : ""}`.toLowerCase();
    const score = words.filter((w) => hasPhrase(title, w)).length;
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item;
}
