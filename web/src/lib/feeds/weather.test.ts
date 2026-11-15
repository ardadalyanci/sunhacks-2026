import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearWeatherCache, getWeather, parseOpenMeteo, summarizeWeather } from "./weather";

const hours = (date: string, feels: number[]) => feels.map((_, h) => `${date}T${String(h).padStart(2, "0")}:00`);
// A mild day and a hot day, 24 hours each; air temperature runs 2 °F under feels-like.
const mild = [55, 54, 53, 52, 52, 53, 55, 58, 62, 66, 70, 73, 76, 78, 79, 79, 77, 74, 70, 66, 63, 60, 58, 56];
const hot = mild.map((f) => f + 30);
const sample = {
  hourly: {
    time: [...hours("2026-11-16", mild), ...hours("2026-11-17", hot)],
    temperature_2m: [...mild, ...hot].map((f) => f - 2),
    apparent_temperature: [...mild, ...hot],
  },
  daily: { time: ["2026-11-16", "2026-11-17"], temperature_2m_max: [77.4, 107.4] },
};

describe("parse and summarize", () => {
  it("reads one day's hours and high", () => {
    const day = parseOpenMeteo(sample, "2026-11-16");
    expect(day?.hourly).toHaveLength(24);
    expect(day?.hourly[13]).toEqual({ hour: 13, tempF: 76, feelsLikeF: 78 });
    expect(day?.highF).toBe(77.4);
    expect(parseOpenMeteo(sample, "2026-11-30")).toBeUndefined();
    expect(parseOpenMeteo({ error: true }, "2026-11-16")).toBeUndefined();
  });

  it("gives { tempF, highF, isHot }: feels-like now (or noon), rounded high, hot at 95 °F feels-like", () => {
    expect(summarizeWeather(parseOpenMeteo(sample, "2026-11-16")!, 9)).toEqual({ tempF: 66, highF: 77, isHot: false });
    expect(summarizeWeather(parseOpenMeteo(sample, "2026-11-16")!)).toEqual({ tempF: 76, highF: 77, isHot: false });
    expect(summarizeWeather(parseOpenMeteo(sample, "2026-11-17")!)).toEqual({ tempF: 106, highF: 107, isHot: true });
  });

  it("does not call a day hot because of a warm night", () => {
    const nightOnly = { hourly: [{ hour: 2, tempF: 96, feelsLikeF: 97 }, { hour: 12, tempF: 80, feelsLikeF: 82 }], highF: 96 };
    expect(summarizeWeather(nightOnly).isHot).toBe(false);
  });
});

describe("getWeather", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    clearWeatherCache();
    fetchMock = vi.fn(async () => Response.json(sample));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks Open-Meteo for Tempe in Fahrenheit, uses the current hour for today, and caches", async () => {
    const now = new Date("2026-11-16T09:20:00-07:00");
    expect(await getWeather(undefined, now)).toEqual({ tempF: 66, highF: 77, isHot: false });
    expect(await getWeather("2026-11-17", now)).toEqual({ tempF: 106, highF: 107, isHot: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("latitude=33.42");
    expect(url).toContain("temperature_unit=fahrenheit");
    expect(url).toContain("timezone=America%2FPhoenix");
  });

  it("returns undefined when Open-Meteo is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await getWeather("2026-11-16")).toBeUndefined();
  });
});
