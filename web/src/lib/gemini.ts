// Gemini client for API routes. Server-side only: never import this from a client component.
// Every call is optional: if GEMINI_API_KEY is missing, the quota runs out, the call is too slow or
// the answer is bad, generateJson returns null and the caller falls back to plain code.
import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { dbFailed, getDb } from "./db";

// The SDK calls the v1 API, which has no "-latest" aliases, so pin a model that v1 serves.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const CACHE_TTL_MS = 60 * 60 * 1000; // the free tier is small, so identical prompts are answered from memory
const CACHE_MAX_ENTRIES = 200;
const TIMEOUT_MS = 12_000; // a slow answer should not stall the Today screen; the fallback is instant

let client: GoogleGenAI | null = null;
const cache = new Map<string, { at: number; value: unknown }>();

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/**
 * Ask Gemini for JSON that matches `schema` (a JSON Schema object). Returns null on any failure, and when
 * `isValid` rejects the answer; rejected answers are not cached, so the next request asks again.
 */
export async function generateJson<T>(prompt: string, schema: object, isValid: (v: unknown) => boolean = () => true): Promise<T | null> {
  const ai = getClient();
  if (!ai) return null;

  const key = `${MODEL}\n${JSON.stringify(schema)}\n${prompt}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  if (hit) cache.delete(key); // expired

  // MongoDB Atlas (optional): answers survive restarts and are shared by every server instance. The key is
  // hashed because prompts contain course names; a stored answer must still pass `isValid`.
  const stored = await readStored(key);
  if (stored !== undefined && isValid(stored)) {
    remember(key, stored);
    return stored as T;
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        temperature: 0.4,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      },
    });
    if (!response.text) return null;
    const value: unknown = JSON.parse(response.text);
    if (!isValid(value)) return null;
    remember(key, value);
    await writeStored(key, value);
    return value as T;
  } catch (err) {
    // Log only the message: prompts can contain the student's course names.
    console.warn(`Gemini call failed (${MODEL}): ${(err as Error).message}`);
    return null;
  }
}

function remember(key: string, value: unknown) {
  cache.delete(key);
  cache.set(key, { at: Date.now(), value });
  // Map keeps insertion order, so the first key is the oldest.
  while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
}

interface StoredAnswer {
  _id: string;
  value: unknown;
  expiresAt: Date;
}
const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

async function readStored(key: string): Promise<unknown> {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const doc = await db.collection<StoredAnswer>("gemini_cache").findOne({ _id: hashKey(key), expiresAt: { $gt: new Date() } });
    return doc ? doc.value : undefined;
  } catch (err) {
    dbFailed(err);
    return undefined;
  }
}

async function writeStored(key: string, value: unknown) {
  const db = await getDb();
  if (!db) return;
  try {
    const _id = hashKey(key);
    await db.collection<StoredAnswer>("gemini_cache").replaceOne({ _id }, { value, expiresAt: new Date(Date.now() + CACHE_TTL_MS) }, { upsert: true });
  } catch (err) {
    dbFailed(err);
  }
}
