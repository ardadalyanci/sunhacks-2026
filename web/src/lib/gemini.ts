// Gemini client for API routes. Server-side only: never import this from a client component.
// Every call is optional: if GEMINI_API_KEY is missing, the quota runs out or the answer is bad,
// generateJson returns null and the caller falls back to plain code.
import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const CACHE_TTL_MS = 60 * 60 * 1000; // the free tier is small, so identical prompts are answered from memory

let client: GoogleGenAI | null = null;
const cache = new Map<string, { at: number; value: unknown }>();

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/** Ask Gemini for JSON that matches `schema` (a JSON Schema object). Returns null on any failure. */
export async function generateJson<T>(prompt: string, schema: object): Promise<T | null> {
  const ai = getClient();
  if (!ai) return null;

  const key = `${MODEL}\n${JSON.stringify(schema)}\n${prompt}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.4 },
    });
    if (!response.text) return null;
    const value = JSON.parse(response.text) as T;
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    // Log only the message: prompts can contain the student's course names.
    console.warn(`Gemini call failed (${MODEL}): ${(err as Error).message}`);
    return null;
  }
}
