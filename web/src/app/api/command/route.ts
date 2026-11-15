// POST /api/command  { transcript, items: DayItem[], picks: CampusEvent[] | EventPick[], briefing?, now? }  →  CommandResult
// (public types in lib/types.ts; `text` is accepted as an alias of `transcript`)
//   "How's my day?"            → { action: "briefing", say: <briefing> }
//   "What's next?"             → { action: "next_item", id, say }
//   "Add the robotics meeting" → { action: "add_event", id: <CampusEvent id>, say }   (UI re-plans with it accepted)
//   "Drop the study block"     → { action: "remove_item", id: <DayItem id>, say }
//   anything else              → { action: "none", say: <help> }
// Gemini understands the sentence; simple keyword rules take over when Gemini is unavailable.
import { generateJson } from "@/lib/gemini";
import { clock, hasPhrase } from "@/lib/planner";
import { type CommandRequest, sanitizeCommandRequest } from "@/lib/sanitize";
import type { CampusEvent, CommandAction, CommandResult, DayItem } from "@/lib/types";

const HELP = 'I can read your day, tell you what is next, or add an event. Try: "add the robotics meeting".';
const STOPWORDS = new Set(["the", "a", "an", "to", "my", "me", "please", "add", "remove", "drop", "cancel", "skip", "join", "meeting", "event", "club", "from", "for", "and", "of", "on", "at", "in", "one"]);

type Target = { id: string; title: string; kind?: string };
const ADD_WORDS = /\b(add|join|go to|sign me up|put|attend)\b/;

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Send JSON: { transcript, items, picks }." }, { status: 400 });
  }
  const req = sanitizeCommandRequest(raw);
  if (!req) return Response.json({ error: "`transcript` is required." }, { status: 400 });

  const onDay = (p: CampusEvent) => req.items.some((i) => i.kind === "event" && i.title === p.title);
  const addable: Target[] = req.picks.filter((p) => !onDay(p));
  const removable: Target[] = req.items.filter((i) => i.kind === "event" || i.kind === "study");

  const decision = (await understand(req.transcript, addable, removable)) ?? byRules(req.transcript, addable, removable);
  // "Add the robotics meeting" when it is already on the day: say so instead of the generic help.
  if (decision.action === "none" && ADD_WORDS.test(req.transcript.toLowerCase())) {
    const already = bestMatch(req.transcript.toLowerCase(), req.picks.filter(onDay));
    if (already) return Response.json({ action: "none", say: `${already.title} is already on your day.` } satisfies CommandResult);
  }
  return Response.json(toResult(decision, req));
}

type Decision = { action: CommandAction; id?: string; reply?: string };

async function understand(text: string, addable: Target[], removable: Target[]): Promise<Decision | null> {
  const prompt = [
    "A student talks to their day-planner app. Map what they said to exactly one action.",
    '- "briefing": they ask about their day or schedule in general.',
    '- "next_item": they ask what is next, where to go now, or when to leave.',
    '- "add_event": they want one of ADDABLE on their day. id must be an id from ADDABLE.',
    '- "remove_item": they want one of REMOVABLE off their day. id must be an id from REMOVABLE.',
    '- "none": anything else. Put a short helpful reply (max 20 words) in "reply".',
    `ADDABLE: ${JSON.stringify(addable.map((a) => ({ id: a.id, title: a.title })))}`,
    `REMOVABLE: ${JSON.stringify(removable.map((r) => ({ id: r.id, title: r.title })))}`,
    `Student said: ${JSON.stringify(text)}`,
  ].join("\n");
  // Only answers naming an action and, for add/remove, an id we actually offered count (and get cached).
  const isValid = (v: unknown): boolean => {
    const a = v as Decision;
    if (a?.action === "briefing" || a?.action === "next_item" || a?.action === "none") return true;
    if (a?.action === "add_event") return addable.some((x) => x.id === a.id);
    if (a?.action === "remove_item") return removable.some((x) => x.id === a.id);
    return false;
  };
  return generateJson<Decision>(
    prompt,
    {
      type: "object",
      properties: {
        action: { type: "string", enum: ["briefing", "next_item", "add_event", "remove_item", "none"] },
        id: { type: "string" },
        reply: { type: "string" },
      },
      required: ["action"],
    },
    isValid,
  );
}

function byRules(text: string, addable: Target[], removable: Target[]): Decision {
  const t = text.toLowerCase();
  if (/\b(next|what now|where (do|should) i go|when (do|should) i leave)\b/.test(t)) return { action: "next_item" };
  if (/(how'?s|how is|what'?s|what is).*(day|today|schedule)|brief/.test(t)) return { action: "briefing" };
  if (/\b(remove|drop|cancel|skip|delete)\b/.test(t)) {
    const hit = bestMatch(t, removable);
    if (hit) return { action: "remove_item", id: hit.id };
  }
  if (ADD_WORDS.test(t)) {
    const hit = bestMatch(t, addable);
    if (hit) return { action: "add_event", id: hit.id };
  }
  return { action: "none" };
}

/** The target whose title shares the most meaningful words with what was said. */
function bestMatch(said: string, targets: Target[]): Target | undefined {
  const words = said.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  let best: { target: Target; score: number } | undefined;
  for (const target of targets) {
    // Study blocks are titled "Work on Lab 7", so "study" and "block" also name them.
    const title = `${target.title} ${target.kind === "study" ? "study block" : ""}`.toLowerCase();
    const score = words.filter((w) => hasPhrase(title, w)).length;
    if (score > 0 && (!best || score > best.score)) best = { target, score };
  }
  return best?.target;
}

/** Turns the decision into what the UI shows and speaks. */
function toResult(d: Decision, req: CommandRequest): CommandResult {
  switch (d.action) {
    case "briefing":
      return { action: "briefing", say: req.briefing ?? summarize(req.items) };
    case "next_item": {
      const next = nextItem(req.items, req.now);
      if (!next?.startsAt) return { action: "next_item", say: "Nothing else is planned today." };
      const leave = req.items.find((i) => i.kind === "leave" && i.forItemId === next.id && i.startsAt);
      return { action: "next_item", id: next.id, say: `Next: ${next.title} at ${clock(next.startsAt)}${leave ? `. Leave at ${clock(leave.startsAt!)}` : ""}.` };
    }
    case "add_event": {
      const pick = req.picks.find((p) => p.id === d.id) as CampusEvent;
      return { action: "add_event", id: pick.id, say: `Added ${pick.title} at ${clock(pick.startsAt)}.` };
    }
    case "remove_item": {
      const item = req.items.find((i) => i.id === d.id) as DayItem;
      return { action: "remove_item", id: item.id, say: `Removed ${item.title} from your day.` };
    }
    default:
      return { action: "none", say: (typeof d.reply === "string" && d.reply.trim().slice(0, 200)) || HELP };
  }
}

/** A short spoken summary from the timeline, for clients that do not send the plan's briefing. */
function summarize(items: DayItem[]): string {
  const at = (i: DayItem) => i.startsAt ?? i.dueAt ?? "";
  const sorted = [...items].sort((a, b) => at(a).localeCompare(at(b)));
  const classes = sorted.filter((i) => i.kind === "class" && i.startsAt);
  const open = sorted.filter((i) => i.kind === "assignment" && !i.submitted && i.dueAt);
  const parts: string[] = [];
  if (classes.length) {
    const first = classes[0];
    const leave = items.find((i) => i.kind === "leave" && i.forItemId === first.id && i.startsAt);
    parts.push(`You have ${classes.length} class${classes.length > 1 ? "es" : ""} today. First up is ${first.title} at ${clock(first.startsAt!)}${leave ? `; leave at ${clock(leave.startsAt!)}` : ""}.`);
  } else {
    parts.push("You have no classes today.");
  }
  if (open.length) parts.push(`${open[0].title} is due at ${clock(open[0].dueAt!)}.`);
  return parts.join(" ");
}

/** The first class, study block or event that starts at or after `now` (leave markers point to these). */
function nextItem(items: DayItem[], now?: string): DayItem | undefined {
  const t = now ? Date.parse(now) : Date.now();
  return items
    .filter((i) => (i.kind === "class" || i.kind === "study" || i.kind === "event") && i.startsAt && Date.parse(i.startsAt) >= t)
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!))[0];
}
