// A small in-memory rate limit for POST /api/schedule: every schedule read is a Gemini call, and the free
// quota is small. Memory is per server instance, which is enough for a hackathon demo.

export function createLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    /** Counts a request from `key`. False when `key` already made `limit` requests in the last `windowMs`. */
    allow(key: string, now = Date.now()): boolean {
      if (hits.size > 10_000) hits.clear(); // never let the map grow without bound
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      const allowed = recent.length < limit;
      if (allowed) recent.push(now);
      hits.set(key, recent);
      return allowed;
    },
    reset() {
      hits.clear();
    },
  };
}

export const SCHEDULE_LIMIT = 5; // reads per minute per address
export const scheduleLimit = createLimiter(SCHEDULE_LIMIT, 60_000);

/** The caller's address as the host reports it (Vercel sets x-forwarded-for), or "local" when there is none. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}
