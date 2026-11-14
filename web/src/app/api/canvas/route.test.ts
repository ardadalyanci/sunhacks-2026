import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

async function call(body: unknown) {
  const res = await POST(new Request("http://test/api/canvas", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/canvas", () => {
  it("validates the body before calling Canvas", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await call("nope")).status).toBe(400);
    expect((await call("null")).status).toBe(400);
    expect((await call({})).status).toBe(400);
    expect((await call({ token: "   " })).status).toBe(400);
    expect((await call({ token: "x".repeat(301) })).status).toBe(400);
    expect((await call({ token: "t", date: "2026-13-01" })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns deadlines for a valid token and passes Canvas errors through", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200 })));
    expect(await call({ token: "t", date: "2026-11-16" })).toEqual({ status: 200, json: { date: "2026-11-16", deadlines: [] } });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const denied = await call({ token: "secret-token-123", date: "2026-11-16" });
    expect(denied.status).toBe(401);
    expect(JSON.stringify(denied.json)).not.toContain("secret-token-123");
  });
});
