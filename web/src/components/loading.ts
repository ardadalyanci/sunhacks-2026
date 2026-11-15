// Request ordering for useDay. No React here, so the rules are easy to test.

/**
 * Runs async jobs where only the newest may change the screen. An answer that lands after a newer job has
 * started is dropped, and every caller resolves with the newest job's answer (null if it failed), because that
 * is what the student ends up seeing.
 */
export function newestWins<T>() {
  let count = 0;
  let newest: Promise<T | null> = Promise.resolve(null);
  return async function run(
    job: () => Promise<T>,
    apply: (value: T) => void,
    fail: (error: unknown) => void,
  ): Promise<T | null> {
    const mine = ++count;
    newest = job().then(
      (value) => {
        if (mine !== count) return null;
        apply(value);
        return value;
      },
      (error: unknown) => {
        if (mine === count) fail(error);
        return null;
      },
    );
    for (;;) {
      const seen = count;
      const result = await newest;
      if (seen === count) return result;
    }
  };
}

/**
 * Shares one load per key for a while: pages that mount one after another, or twice in React's StrictMode,
 * reuse the same request instead of starting their own, and going back to a day seen a moment ago is instant.
 * Keeps the `maxEntries` most recently used keys. A failed load is forgotten, so the next visit retries.
 */
export function createShared<T>(maxAgeMs: number, maxEntries = 8) {
  type Entry = { at: number; value: Promise<T> };
  const entries = new Map<string, Entry>();
  function put(key: string, entry: Entry) {
    entries.delete(key); // re-insert so the Map's order stays oldest first
    entries.set(key, entry);
    for (const oldest of entries.keys()) {
      if (entries.size <= maxEntries) break;
      entries.delete(oldest);
    }
  }
  return {
    get(key: string, load: () => Promise<T>, now = Date.now()): Promise<T> {
      const hit = entries.get(key);
      if (hit && now - hit.at < maxAgeMs) {
        put(key, hit); // now the most recently used
        return hit.value;
      }
      const entry = { at: now, value: load() };
      put(key, entry);
      entry.value.catch(() => {
        if (entries.get(key) === entry) entries.delete(key);
      });
      return entry.value;
    },
    /** Stores a newer answer for `key`, for example after the student changed their day. */
    set(key: string, value: T, now = Date.now()) {
      put(key, { at: now, value: Promise.resolve(value) });
    },
  };
}
