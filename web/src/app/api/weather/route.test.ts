import { describe, expect, it, vi } from "vitest";

const getWeather = vi.fn();
vi.mock("@/lib/feeds/weather", () => ({ getWeather: (d?: string) => getWeather(d) }));
const { GET } = await import("./route");

describe("GET /api/weather", () => {
  it("returns the day's weather", async () => {
    getWeather.mockResolvedValue({ tempF: 74, highF: 81, isHot: false });
    const res = await GET(new Request("http://t/api/weather?date=2026-11-16"));
    expect(await res.json()).toEqual({ tempF: 74, highF: 81, isHot: false });
    expect(getWeather).toHaveBeenLastCalledWith("2026-11-16");
  });

  it("validates the date and reports an outage", async () => {
    expect((await GET(new Request("http://t/api/weather?date=2026-02-30"))).status).toBe(400);
    getWeather.mockResolvedValue(undefined);
    expect((await GET(new Request("http://t/api/weather"))).status).toBe(502);
  });
});
