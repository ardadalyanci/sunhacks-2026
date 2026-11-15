// MongoDB Atlas, server-side only. Optional: with MONGODB_URI unset (tests, CI, the offline demo) getDb()
// returns null and every caller keeps working without a database.
// Short timeouts, because a slow answer must never stall /api/plan on expo Wi-Fi; after a failure the
// database is skipped for a minute instead of being retried on every request.
import { MongoClient, type Db } from "mongodb";

const TIMEOUT_MS = 1500;
const RETRY_AFTER_MS = 60_000;

let client: Promise<MongoClient> | null = null;
let indexes: Promise<unknown> | null = null;
let downUntil = 0;

export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || Date.now() < downUntil) return null;
  try {
    client ??= new MongoClient(uri, {
      appName: "daypilot",
      serverSelectionTimeoutMS: TIMEOUT_MS,
      connectTimeoutMS: TIMEOUT_MS,
      socketTimeoutMS: 3 * TIMEOUT_MS,
      maxPoolSize: 5,
    }).connect();
    // The database keeps the working name (DayPilot), so saved plans and cached Gemini answers survive the rename.
    const db = (await client).db(process.env.MONGODB_DB?.trim() || "daypilot");
    // TTL indexes: Atlas deletes saved plans and cached Gemini answers by themselves once `expiresAt` passes.
    indexes ??= Promise.all([
      db.collection("plans").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("plans").createIndex({ calendarId: 1, date: 1 }),
      db.collection("gemini_cache").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]);
    await indexes;
    return db;
  } catch (err) {
    dbFailed(err);
    return null;
  }
}

/** Call when a database operation fails: forget the client and skip the database for a minute. */
export function dbFailed(err: unknown) {
  console.warn(`MongoDB unavailable: ${(err as Error)?.message ?? err}`);
  client = null;
  indexes = null;
  downUntil = Date.now() + RETRY_AFTER_MS;
}
