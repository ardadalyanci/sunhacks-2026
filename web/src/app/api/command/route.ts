// POST /api/command  { text: string, plan: DayPlan }  →  CommandAction
// Turns what the student said into one action on the current plan:
//   "How's my day?"            → { action: "briefing" }            (UI speaks plan.briefing)
//   "Add the robotics meeting" → { action: "add_event", itemId }   (UI re-calls /api/plan with the id in acceptedEventIds)
//   "Drop the study block"     → { action: "remove_item", itemId }
// Gemini understands the sentence; simple keyword rules take over when Gemini is unavailable.
import { generateJson } from "@/lib/gemini";
import type { CommandAction, DayItem, DayPlan } from "@/lib/types";

const HELP = 'Try "How\'s my day?" or "Add the robotics meeting".';
const STOPWORDS = new Set(["the", "a", "an", "to", "my", "me", "please", "add", "remove", "drop", "cancel", "skip", "join", "meeting", "event", "club", "from", "for", "and", "of", "on", "at", "in"]);

export async function POST(request: Request) {
  let body: { text?: unknown; plan?: Partial<DayPlan> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON: { text, plan }." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 300) : "";
  if (!text) return Response.json({ error: "`text` is required." }, { status: 400 });

  const addable = Array.isArray(body.plan?.suggestions) ? body.plan.suggestions : [];
  const removable = (Array.isArray(body.plan?.items) ? body.plan.items : []).filter((i) => i.type === "event" || i.type === "study_block");

  const action = (await understand(text, addable, removable)) ?? byRules(text, addable, removable);
  return Response.json(action);
}

async function understand(text: string, addable: DayItem[], removable: DayItem[]): Promise<CommandAction | null> {
  const prompt = [
    "A student talks to their day-planner app. Map what they said to exactly one action.",
    '- "briefing": they ask about their day, schedule or what is next.',
    '- "add_event": they want one of ADDABLE on their day. itemId must be an id from ADDABLE.',
    '- "remove_item": they want one of REMOVABLE off their day. itemId must be an id from REMOVABLE.',
    '- "unknown": anything else. Put a short helpful reply (max 20 words) in "reply".',
    `ADDABLE: ${JSON.stringify(addable.map((a) => ({ id: a.id, title: a.title })))}`,
    `REMOVABLE: ${JSON.stringify(removable.map((r) => ({ id: r.id, title: r.title })))}`,
    `Student said: ${JSON.stringify(text)}`,
  ].join("\n");
  const result = await generateJson<{ action: string; itemId?: string; reply?: string }>(prompt, {
    type: "object",
    properties: {
      action: { type: "string", enum: ["briefing", "add_event", "remove_item", "unknown"] },
      itemId: { type: "string" },
      reply: { type: "string" },
    },
    required: ["action"],
  });
  if (!result) return null;
  if (result.action === "briefing") return { action: "briefing" };
  if (result.action === "add_event" && addable.some((a) => a.id === result.itemId)) return { action: "add_event", itemId: result.itemId! };
  if (result.action === "remove_item" && removable.some((r) => r.id === result.itemId)) return { action: "remove_item", itemId: result.itemId! };
  if (result.action === "unknown") return { action: "unknown", reply: result.reply?.trim() || HELP };
  return null; // an id we did not offer: let the rules decide
}

function byRules(text: string, addable: DayItem[], removable: DayItem[]): CommandAction {
  const t = text.toLowerCase();
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
    const title = item.title.toLowerCase();
    const score = words.filter((w) => title.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item;
}
