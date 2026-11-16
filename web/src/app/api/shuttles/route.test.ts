import { describe, expect, it } from "vitest";
import { GET } from "./route";

const call = async (query: string) => {
  const res = await GET(new Request(`http://test/api/shuttles${query}`));
  return { status: res.status, json: await res.json() };
};

describe("GET /api/shuttles", () => {
  it("answers with options for two campuses", async () => {
    const { status, json } = await call("?from=Tempe&to=polytechnic&arriveBy=2026-11-16T10:10:00-07:00");
    expect(status).toBe(200);
    expect(json).toMatchObject({ from: "tempe", to: "polytechnic", date: "2026-11-16", period: "weekday" });
    expect(json.options[0]).toMatchObject({ routeId: "gold", beAtStopBy: "2026-11-16T09:05:00-07:00" });
  });

  it("uses `at` for the day when there is no arriveBy", async () => {
    const { json } = await call("?from=west&to=tempe&at=2026-11-15T12:00:00-07:00");
    expect(json.period).toBe("weekend");
    expect(json.options.map((o: { routeId: string; running: boolean }) => [o.routeId, o.running])).toEqual([
      ["maroon", true],
      ["tempe-west-express", false],
    ]);
  });

  it("answers 400 for unknown campuses or bad dates", async () => {
    expect((await call("?from=tempe&to=mesa")).status).toBe(400);
    expect((await call("?to=tempe")).status).toBe(400);
    expect((await call("?from=tempe&to=west&arriveBy=soon")).status).toBe(400);
    expect((await call("?from=tempe&to=west&at=yesterday")).status).toBe(400);
  });
});
