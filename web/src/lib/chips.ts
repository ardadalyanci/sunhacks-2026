// The ready-made questions under Sol's chat. The command route answers each one in code (no Gemini call), so they
// work offline and cost nothing; anything else the student types goes to Gemini with the day's facts.
export const CHIPS = [
  { text: "What's due?", topic: "due" },
  { text: "When should I leave?", topic: "next" },
  { text: "Do I have free time?", topic: "free" },
  { text: "How hot is it?", topic: "weather" },
] as const;

export type ChipTopic = (typeof CHIPS)[number]["topic"];

const norm = (s: string) => s.toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();

/** The chip a message is, when it is one word for word (case and punctuation aside). */
export function chipTopic(text: string): ChipTopic | undefined {
  const said = norm(text);
  return CHIPS.find((c) => norm(c.text) === said)?.topic;
}
