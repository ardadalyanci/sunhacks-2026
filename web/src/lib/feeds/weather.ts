// Tempe weather from Open-Meteo (free, no key) as the shared Weather type { tempF, highF, isHot }.
// Server-only, one forecast download cached for 30 minutes.
//   tempF  = feels-like temperature now (for today) or at noon (for another day)
//   highF  = the day's forecast high (air temperature)
//   isHot  = the feels-like temperature reaches 95 °F at any hour between 8 AM and 8 PM
import { CAMPUS_INFO, type Campus } from "../campuses";
import type { Weather } from "../types";

export const TEMPE = { latitude: 33.42, longitude: -111.93 };
export const HOT_FEELS_LIKE_F = 95;
const CACHE_MS = 30 * 60_000;
const FETCH_TIMEOUT_MS = 10_000;

export function openMeteoUrl(days = 8, campus: Campus = "tempe"): string { // today + 7 days ahead
  const at = campus === "tempe" ? TEMPE : CAMPUS_INFO[campus];
  const q = new URLSearchParams({
    latitude: String(at.latitude),
    longitude: String(at.longitude),
    hourly: "temperature_2m,apparent_temperature",
    daily: "temperature_2m_max",
    temperature_unit: "fahrenheit",
    timezone: "America/Phoenix",
    forecast_days: String(days),
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

interface OpenMeteo {
  hourly?: { time?: string[]; temperature_2m?: (number | null)[]; apparent_temperature?: (number | null)[] };
  daily?: { time?: string[]; temperature_2m_max?: (number | null)[] };
}

export interface HourlyTemp {
  hour: number; // 0-23, Arizona time
  tempF: number;
  feelsLikeF: number;
}

/** One day's hours ("2026-11-16") and high out of an Open-Meteo answer, or undefined when the day is missing. */
export function parseOpenMeteo(json: unknown, date: string): { hourly: HourlyTemp[]; highF: number } | undefined {
  const data = json as OpenMeteo;
  const times = data?.hourly?.time ?? [];
  const temps = data?.hourly?.temperature_2m ?? [];
  const feels = data?.hourly?.apparent_temperature ?? [];
  const hourly: HourlyTemp[] = [];
  times.forEach((t, i) => {
    // Local times without an offset ("2026-11-16T13:00") because we asked for America/Phoenix.
    if (!t.startsWith(date)) return;
    const tempF = temps[i];
    if (typeof tempF !== "number") return;
    const feelsLikeF = feels[i];
    hourly.push({ hour: Number(t.slice(11, 13)), tempF, feelsLikeF: typeof feelsLikeF === "number" ? feelsLikeF : tempF });
  });
  if (!hourly.length) return undefined;
  const dayIndex = data?.daily?.time?.indexOf(date) ?? -1;
  const dailyMax = dayIndex >= 0 ? data?.daily?.temperature_2m_max?.[dayIndex] : undefined;
  return { hourly, highF: typeof dailyMax === "number" ? dailyMax : Math.max(...hourly.map((h) => h.tempF)) };
}

/** Hours → Weather. `hourNow` is the current Arizona hour when the day is today; otherwise noon is used. */
export function summarizeWeather(day: { hourly: HourlyTemp[]; highF: number }, hourNow?: number): Weather {
  const target = hourNow ?? 12;
  const current = day.hourly.reduce((best, h) => (Math.abs(h.hour - target) < Math.abs(best.hour - target) ? h : best));
  const daytime = day.hourly.filter((h) => h.hour >= 8 && h.hour <= 20);
  const peakFeels = Math.max(...(daytime.length ? daytime : day.hourly).map((h) => h.feelsLikeF));
  return { tempF: Math.round(current.feelsLikeF), highF: Math.round(day.highF), isHot: peakFeels >= HOT_FEELS_LIKE_F };
}

const caches = new Map<Campus, { json: unknown; fetchedAt: number }>();

/** A campus's weather (default Tempe) for today, or for `date` up to 7 days ahead. Undefined when Open-Meteo is unreachable. */
export async function getWeather(date?: string, now = new Date(), campus: Campus = "tempe"): Promise<Weather | undefined> {
  let cache = caches.get(campus) ?? null;
  const today = arizonaDate(now);
  const day = date ?? today;
  if (!cache || Date.now() - cache.fetchedAt > CACHE_MS || !parseOpenMeteo(cache.json, day)) {
    try {
      const res = await fetch(openMeteoUrl(8, campus), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cache = { json: await res.json(), fetchedAt: Date.now() };
      caches.set(campus, cache);
    } catch {
      // Keep an older copy if we have one; it may still cover the day.
      if (!cache) return undefined;
    }
  }
  const parsed = parseOpenMeteo(cache.json, day);
  return parsed && summarizeWeather(parsed, day === today ? arizonaHour(now) : undefined);
}

const AZ_MS = 7 * 60 * 60_000;
const arizonaDate = (d: Date) => new Date(d.getTime() - AZ_MS).toISOString().slice(0, 10);
const arizonaHour = (d: Date) => new Date(d.getTime() - AZ_MS).getUTCHours();

/** Test helper. */
export function clearWeatherCache(): void {
  caches.clear();
}
