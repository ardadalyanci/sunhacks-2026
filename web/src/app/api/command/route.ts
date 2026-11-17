// POST /api/command  { text, plan: DayPlan, now?: ISO, date?, deadlines?, weather?, history? }  →  CommandAction
// Turns what the student said into one action on the current plan:
//   "How's my day?"            → { action: "briefing" }            (UI speaks plan.briefing)
//   "What's next?" / "When do I leave?" → { action: "briefing", reply: "Next up: CSE 230 at 10:30 am in Brickyard 210. Leave at 10:20 am." }
//                                (code finds the next stop after `now`, default the server clock; UI speaks reply)
//   "Add the robotics meeting" → { action: "add_event", itemId }   (UI re-calls /api/plan with the id in acceptedEventIds)
//   "Drop the study block"     → { action: "remove_item", itemId }
//   Any other question about the day ("Do I have time for lunch before CSE 240?") → { action: "briefing", reply }:
//                                Gemini answers from the day's facts, worked out by code (facts.ts), with the last
//                                few chat turns (`history`) so a follow-up ("and after that?") makes sense.
// The chips under the chat ("What's due?", …) are answered by code. Gemini understands everything else; simple
// keyword rules take over when Gemini is unavailable.
import { chipTopic } from "@/lib/chips";
import { generateJson } from "@/lib/gemini";
import { polishLine } from "@/lib/places";
import { clock, hasPhrase, mstDate } from "@/lib/planner";
import { sanitizeCommandContext, sanitizePlanForCommand } from "@/lib/sanitize";
import { dayOpener, spokenEvent, spokenItem, spokenWhere } from "@/lib/say";
import type { CommandAction, DayItem } from "@/lib/types";
import { type EditAnswer, ruleEdit, toEdit } from "./edits";
import { type CommandDay, dayFacts, isTutoringQuestion, dueReply, freeReply, relativeReply, timesIn, tutoringReply, weatherReply, withoutHeatTips } from "./facts";
import { tutoringHelp } from "@/lib/tutoring";

type Turn = { from: "you" | "sol"; text: string };

/** "Drop the study block", "the study time, skip it": a removal that names a study block, in either order. */
const isStudyRemoval = (text: string) => /\b(remove|drop|cancel|skip|delete)\b/i.test(text) && /\bstudy (block|time|session)s?\b/i.test(text);

/** "Should I go to the lunch talk?", "is the mixer worth it": asking, not telling Sol to do something. */
const isQuestion = (text: string) => /\?|^\s*(should|shall|can|could|would|will|is|are|do|does|what|why|how|when|where|which)\b/i.test(text);

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
  const context = sanitizeCommandContext(body);
  const addable = plan.suggestions;
  const removable = plan.items.filter((i) => i.type === "event" || i.type === "study_block");
  const classes = plan.items.filter((i) => i.type === "class");
  const edits = { classes, skipped: context.skipped };

  const nowMs = typeof body?.now === "string" && !Number.isNaN(Date.parse(body.now)) ? Date.parse(body.now) : Date.now();
  const firstStart = plan.items.find((i) => i.start)?.start;
  const date = context.date ?? (firstStart ? mstDate(new Date(firstStart)) : mstDate(new Date(nowMs)));
  const day: CommandDay = {
    date,
    items: plan.items,
    suggestions: plan.suggestions,
    deadlines: context.deadlines,
    weather: context.weather,
    help: tutoringHelp(context.deadlines, plan.items, date, nowMs, context.campus),
  };

  // The chips under the chat are answered by code: no Gemini call, and they work when Gemini is out.
  const chip = chipTopic(text);
  if (chip) return Response.json(chipAction(chip, day, plan.items, nowMs, text));
  // "And after that?" right after talking about CSE 240: what comes after it, worked out in code.
  const relative = relativeReply(text, context.history, day);
  if (relative) return Response.json({ action: "briefing", reply: polishLine(relative) } satisfies CommandAction);
  // "Where can I get help with ENG 102?": the tutoring centers that fit, worked out in code.
  if (isTutoringQuestion(text)) return Response.json({ action: "briefing", reply: polishLine(tutoringReply(text, day)) } satisfies CommandAction);

  // "Drop the study block" is answered by the keyword rule, with no Gemini call: Gemini sees study blocks only as
  // "Work on: …" titles and sometimes answers that there is none (and that answer gets cached). Only when the
  // student names a study block, time or session, so "cancel the study group" (a commitment) still goes to Gemini.
  const quick = isStudyRemoval(text) ? byRules(text, addable, removable, day, nowMs, edits) : null;
  const rules = byRules(text, addable, removable, day, nowMs, edits);
  let decision =
    (quick?.action === "remove_item" ? quick : null) ??
    (await understand(text, addable, removable, day, nowMs, context.history, edits)) ??
    rules;
  // A clear edit the rules understood ("skip MAT 343") beats Gemini saying it can't help.
  if (decision.action === "unknown" && ["add_block", "skip_class", "restore_class", "study_from"].includes(rules.action)) decision = rules;
  // "Add the robotics meeting" once came back as "I couldn't find a robotics meeting" while robotics night was a
  // pick (Gemini does not always see "meeting" in "build night"). When the student asks to add something and a pick
  // shares its words, add it. Not for questions: "should I go to the lunch talk?" gets Gemini's answer.
  if (decision.action === "unknown" && rules.action === "add_event" && !isQuestion(text)) decision = rules;
  const action: CommandAction =
    decision.action === "next_item" ? { action: "briefing", reply: polishLine(nextReply(plan.items, nowMs, text)) } : decision;
  return Response.json(action);
}

/** A chip's answer, in code. */
function chipAction(topic: ReturnType<typeof chipTopic>, day: CommandDay, items: DayItem[], nowMs: number, text: string): CommandAction {
  const reply =
    topic === "due"
      ? dueReply(day, nowMs)
      : topic === "free"
        ? freeReply(day, nowMs)
        : topic === "weather"
          ? weatherReply(day)
          : topic === "help"
            ? tutoringReply(text, day)
            : nextReply(items, nowMs, text);
  return { action: "briefing", reply: polishLine(reply) };
}

/** Marker for "what's next / when do I leave": answered from the plan by code, not by Gemini. */
const NEXT = { action: "next_item" } as const;
type Decision = CommandAction | typeof NEXT;

/** "a 17-minute walk", or the trip /api/plan described in `via` (an ASU shuttle, or the trip from an off-campus home). */
function tripWords(item: DayItem, minutes: number): string {
  if (!item.via) return `a ${minutes}-minute walk`;
  if (item.via.startsWith("From home") && !item.via.includes("shuttle")) return `a ${minutes}-minute trip from home`;
  return `about ${minutes} minutes with the shuttle`;
}

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
    const line = begin(`${leave(walk.leaveAt)} for ${spokenItem(walk)}${spokenWhere(walk)}, ${tripWords(walk, minutes)}.`);
    if (walk === next) return line;
    const doing = next.type === "study_block" ? "you're on" : "you have";
    return `${line} Until then, ${doing} ${spokenItem(next)} at ${clock(next.start)}.`;
  }
  const head = `${opener ? `${opener}, first up is` : "Next up:"} ${spokenItem(next)} at ${clock(next.start)}${spokenWhere(next)}.`;
  if (next.leaveAt) return `${head} ${cap(leave(next.leaveAt))}.`;
  if (!walk?.leaveAt) return head;
  return `${head} Then ${leave(walk.leaveAt)} for ${spokenItem(walk)}${spokenWhere(walk)}.`;
}

async function understand(
  text: string,
  addable: DayItem[],
  removable: DayItem[],
  day: CommandDay,
  nowMs: number,
  history: Turn[],
  edits: { classes: DayItem[]; skipped: string[] },
): Promise<Decision | null> {
  const facts = dayFacts(day, nowMs);
  const prompt = [
    "A student talks to their day-planner app. You are its sun mascot, Sol. Map what they said to exactly one action.",
    '- "briefing": they ask for a summary of their whole day.',
    '- "next_item": they ask what is next from now, where to go now, or when to leave. Not when they mean "after" or "before" something named earlier in CONVERSATION: that is "answer".',
    '- "add_event": they want one of ADDABLE on their day. itemId must be an id from ADDABLE.',
    '- "remove_item": they want one of REMOVABLE off their day. itemId must be an id from REMOVABLE.',
    '- "answer": any other question about their day, deadlines, free time, weather, trips, classes or events. Put the answer in "reply": at most 45 words, as Sol ("I"), warm and plain, no lists. Use ONLY the FACTS below; never invent a time, place, class or deadline. If the FACTS do not say, say you don\'t know that from their day. Add a tip only when it helps with what they asked (starting an assignment in a free stretch); mention water or heat only when WEATHER says it is a hot day.',
    '- "add_block": they want something of their own on today\'s plan ("add gym at 5 for an hour"). Give "title" (short, like "Gym"), "start" as 24-hour "HH:MM", "minutes" (default 60) and "location" if they said one.',
    '- "skip_class": they are skipping one of CLASSES today, or want a block they added taken off. itemId must be an id from CLASSES.',
    '- "restore_class": they want one of SKIPPED back on today. "course" must be from SKIPPED.',
    '- "study_from": they want study time later ("move my study time to after CSE 240", "no studying before 2"). Give itemId from CLASSES when they name one (study starts when it ends), else "time" as 24-hour "HH:MM".',
    '- "unknown": not about their day at all. Put a short reply (max 25 words) in "reply" saying what you can help with.',
    "Never ask a question back. Use CONVERSATION to understand follow-ups: \"and after that?\" means after the thing just talked about, so answer from the SCHEDULE after it.",
    // "Should I go to the lunch talk?" is a question about one of Sol's picks: a straight answer, not "I'm not sure".
    'If they ask whether to go to something in ADDABLE, answer "Yes" first, then one reason from its "why", title or time, then how to add it, like "Yes: it\'s at noon and it\'s about software internships. Say add the lunch & learn." Never say you are not sure.',
    'If they wanted to add something and nothing in ADDABLE matches, use "unknown": say you couldn\'t find it today and name what you can add.',
    `FACTS:\n${facts}`,
    `ADDABLE: ${JSON.stringify(addable.map((a) => ({ id: a.id, title: a.title, ...(a.start ? { time: clock(a.start) } : {}), ...(a.why ? { why: a.why } : {}) })))}`,
    `REMOVABLE: ${JSON.stringify(removable.map((r) => ({ id: r.id, title: r.title })))}`,
    `CLASSES: ${JSON.stringify(edits.classes.map((c) => ({ id: c.id, title: c.title, time: clock(c.start) })))}`,
    `SKIPPED: ${JSON.stringify(edits.skipped)}`,
    `CONVERSATION (oldest first): ${history.length ? JSON.stringify(history.map((h) => `${h.from === "you" ? "Student" : "Sol"}: ${h.text}`)) : "none"}`,
    `Student said: ${JSON.stringify(text)}`,
  ].join("\n");
  type Answer = EditAnswer & { reply?: string };
  // Only answers that name an action and, for add/remove, an id we actually offered count (and get cached).
  // A reply that asks a question back is a dead end, and an answer with a clock time the facts do not have is made
  // up: the keyword rules answer instead.
  const known = new Set(timesIn(facts));
  const isValid = (v: unknown): boolean => {
    const a = v as Answer;
    if (a?.action === "answer") {
      return typeof a.reply === "string" && a.reply.trim().length > 0 && !a.reply.includes("?") && timesIn(a.reply).every((x) => known.has(x));
    }
    if (a?.action === "unknown") return typeof a.reply !== "string" || !a.reply.includes("?");
    if (a?.action === "briefing" || a?.action === "next_item") return true;
    if (["add_block", "skip_class", "restore_class", "study_from"].includes(a?.action)) return toEdit(a, edits.classes, edits.skipped) !== null;
    if (a?.action === "add_event") return addable.some((x) => x.id === a.itemId);
    if (a?.action === "remove_item") return removable.some((x) => x.id === a.itemId);
    return false;
  };
  const result = await generateJson<Answer>(
    prompt,
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["briefing", "next_item", "add_event", "remove_item", "answer", "add_block", "skip_class", "restore_class", "study_from", "unknown"],
        },
        itemId: { type: "string" },
        reply: { type: "string" },
        title: { type: "string" },
        start: { type: "string" },
        minutes: { type: "integer" },
        location: { type: "string" },
        course: { type: "string" },
        time: { type: "string" },
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
  const edit = toEdit(result, edits.classes, edits.skipped);
  if (edit) return edit;
  if (result.action === "answer") return { action: "briefing", reply: polishLine(withoutHeatTips(result.reply!.trim(), day.weather).slice(0, 400)) };
  return { action: "unknown", reply: (typeof result.reply === "string" && result.reply.trim().slice(0, 300)) || help(addable) };
}

const ADD_WORDS = /\b(add|join|go to|sign me up(?: for)?|put|attend)\b/;

function byRules(
  text: string,
  addable: DayItem[],
  removable: DayItem[],
  day: CommandDay,
  nowMs: number,
  edits: { classes: DayItem[]; skipped: string[] },
): Decision {
  // Phones type curly apostrophes ("How’s my day?"); the rules below expect straight ones.
  const t = text.toLowerCase().replace(/[‘’ʼ]/g, "'");
  const edit = ruleEdit(text.replace(/[‘’ʼ]/g, "'"), edits.classes, edits.skipped); // keeps the student's capitals for a title
  if (edit) return edit;
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
  // Without Gemini, the common questions still get the code's answer.
  if (/\b(due|deadlines?|assignments?|homework|turned in)\b/.test(t)) return { action: "briefing", reply: polishLine(dueReply(day, nowMs)) };
  if (/\b(free|break|gap|lunch)\b/.test(t)) return { action: "briefing", reply: polishLine(freeReply(day, nowMs)) };
  if (/\b(hot|heat|weather|temperature|degrees)\b/.test(t)) return { action: "briefing", reply: polishLine(weatherReply(day)) };
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
