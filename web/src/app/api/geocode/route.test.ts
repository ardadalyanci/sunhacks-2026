import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { resetSearch, shortLabel } from "./search";

const ask = (q: unknown, ip = "1.2.3.4") =>
  POST(new Request("http://test/api/geocode", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify({ q }) }));

// A public place: Tempe Center for the Arts.
const TCA = { display_name: "Tempe Center for the Arts, 700, West Rio Salado Parkway, Tempe, Maricopa County, Arizona, 85281, United States", lat: "33.43164", lon: "-111.94526" };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetSearch();
  fetchMock = vi.fn(async () => new Response(JSON.stringify([TCA, { display_name: "Tucson", lat: "32.22", lon: "-110.97" }])));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/geocode", () => {
  it("finds places in the Phoenix area, rounded, with a short label", async () => {
    const res = await ask("Tempe Center for the Arts");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ places: [{ label: "Tempe Center for the Arts, 700 West Rio Salado Parkway, Tempe", lat: 33.432, lng: -111.945 }] });
    const url = new URL(fetchMock.mock.calls[0][0] as URL);
    expect(url.origin + url.pathname).toBe("https://nominatim.openstreetmap.org/search");
    expect(url.searchParams.get("bounded")).toBe("1");
    expect(url.searchParams.get("q")).toBe("Tempe Center for the Arts");
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ "User-Agent": expect.stringContaining("Sundial") });
  });

  it("answers a repeated search from the cache", async () => {
    await ask("Tempe Center for the Arts");
    await ask("  tempe   center for the arts ");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty or huge query, and says so when the search is down", async () => {
    expect((await ask("")).status).toBe(400);
    expect((await ask(42)).status).toBe(400);
    expect((await ask("x".repeat(201))).status).toBe(400);
    fetchMock.mockResolvedValueOnce(new Response("busy", { status: 503 }));
    expect((await ask("Somewhere new")).status).toBe(502);
  });

  it("limits each address to 10 searches a minute", async () => {
    for (let i = 0; i < 10; i++) expect((await ask("abc", "9.9.9.9")).status).toBe(200);
    expect((await ask("abc", "9.9.9.9")).status).toBe(429);
    expect((await ask("abc", "8.8.8.8")).status).toBe(200);
  });
});

describe("shortLabel", () => {
  it("keeps the street and city, without county, state, zip and country", () => {
    expect(shortLabel("1001, South Mill Avenue, Tempe, Maricopa County, Arizona, 85281, United States")).toBe("1001 South Mill Avenue, Tempe");
  });
});
