// POST /api/command  { text: string, plan: DayPlan, now?: ISO }  →  CommandAction
// Turns what the student said into one action on the current plan:
//   "How's my day?"            → { action: "briefing" }            (UI speaks plan.briefing)
//   "What's next?" / "When do I leave?" → { action: "briefing", reply: "Next: CSE 230 at 10:30 AM in BYENG 210. Leave by 10:20 AM." }
//                                (code finds the next stop after `now`, default the server clock; UI speaks reply)
//   "Add the robotics meeting" → { action: "add_event", itemId }   (UI re-calls /api/plan with the id in acceptedEventIds)
//   "Drop the study block"     → { action: "remove_item", itemId }
// Gemini understands the sentence; simple keyword rules take over when Gemini is unavailable.
import { generateJson } from "@/lib/gemini";
import { placeLabel, polishLine } from "@/lib/places";
import { clock, hasPhrase } from "@/lib/planner";
import { sanitizePlanForCommand } from "@/lib/sanitize";
import type { CommandAction, DayItem } from "@/lib/types";

const HELP = 'Try "How\'s my day?" or "Add the robotics meeting".';
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

  const decision = (await understand(text, addable, removable)) ?? byRules(text, addable, removable);
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
 * "What's next / when do I leave": the next class, event or study block after `nowMs`, and the next walk.
 * A leave question names the walk first, even when a study block comes before it ("Until then: …").
 */
function nextReply(items: DayItem[], nowMs: number, text: string): string {
  const upcoming = items
    .filter((i) => (i.type === "class" || i.type === "event" || i.type === "study_block") && Date.parse(i.start) > nowMs)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const next = upcoming[0];
  if (!next) return "Nothing else is planned today.";
  const walk = upcoming.find((i) => i.leaveAt); // the next stop the student walks to
  // "CSE 230 at 10:30 AM in Brickyard 210", "Work shift at 10 AM at the MU": places as students say them.
  const at = (i: DayItem) =>
    `${i.title} at ${clock(i.start)}${i.location ? ` ${/^[A-Z]{2,4} \d{3}/.test(i.title) ? "in" : "at"} ${placeLabel(i.location)}` : ""}`;
  const leaveBy = (leaveAt: string) => (Date.parse(leaveAt) <= nowMs ? "Leave now" : `Leave by ${clock(leaveAt)}`);

  if (walk?.leaveAt && LEAVE_WORDS.test(text)) {
    const minutes = Math.max(1, Math.round((Date.parse(walk.start) - Date.parse(walk.leaveAt)) / 60_000));
    const line = `${leaveBy(walk.leaveAt)} for ${at(walk)}, a ${minutes}-minute walk.`;
    return walk === next ? line : `${line} Until then: ${next.title} at ${clock(next.start)}.`;
  }
  if (next.leaveAt) return `Next: ${at(next)}. ${leaveBy(next.leaveAt)}.`;
  if (!walk?.leaveAt) return `Next: ${at(next)}.`;
  const then = Date.parse(walk.leaveAt) <= nowMs ? "Then leave now" : `Then leave by ${clock(walk.leaveAt)}`;
  return `Next: ${at(next)}. ${then} for ${walk.title}.`;
}

async function understand(text: string, addable: DayItem[], removable: DayItem[]): Promise<Decision | null> {
  const prompt = [
    "A student talks to their day-planner app. Map what they said to exactly one action.",
    '- "briefing": they ask about their whole day or schedule.',
    '- "next_item": they ask what is next, where to go now, or when to leave.',
    '- "add_event": they want one of ADDABLE on their day. itemId must be an id from ADDABLE.',
    '- "remove_item": they want one of REMOVABLE off their day. itemId must be an id from REMOVABLE.',
    '- "unknown": anything else. Put a short helpful reply (max 20 words) in "reply".',
    `ADDABLE: ${JSON.stringify(addable.map((a) => ({ id: a.id, title: a.title })))}`,
    `REMOVABLE: ${JSON.stringify(removable.map((r) => ({ id: r.id, title: r.title })))}`,
    `Student said: ${JSON.stringify(text)}`,
  ].join("\n");
  type Answer = { action: string; itemId?: string; reply?: string };
  // Only answers that name an action and, for add/remove, an id we actually offered count (and get cached).
  const isValid = (v: unknown): boolean => {
    const a = v as Answer;
    if (a?.action === "briefing" || a?.action === "next_item" || a?.action === "unknown") return true;
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
  return { action: "unknown", reply: (typeof result.reply === "string" && result.reply.trim().slice(0, 200)) || HELP };
}

function byRules(text: string, addable: DayItem[], removable: DayItem[]): Decision {
  const t = text.toLowerCase();
  if (/\b(next|what now|where (do|should) i (go|be)|when (do|should) i (leave|go|head out)|head out|am i late|my walk)\b/.test(t)) return NEXT;
  if (/(how'?s|how is|what'?s|what is).*(day|today|schedule|next)|brief/.test(t)) return { action: "briefing" };
  if (/\b(remove|drop|cancel|skip|delete)\b/.test(t)) {
    const hit = bestMatch(t, removable);
    if (hit) return { action: "remove_item", itemId: hit.id };
  }
  if (/\b(add|join|go to|sign me up|put|attend)\b/.test(t)) {
    const hit = bestMatch(t, addable);
    if (hit) return { action: "add_event", itemId: hit.id };
  }
  return { action: "unknown", reply: HELP };
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
