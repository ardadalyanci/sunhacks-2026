import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [key, value] of Object.entries(fields)) f.append(key, value);
  return f;
}

async function call(body: FormData) {
  const res = await POST(new Request("http://test/api/schedule", { method: "POST", body }));
  return { status: res.status, json: await res.json() };
}

function geminiAnswer(value: unknown) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }), {
    status: 200,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/schedule", () => {
  it("needs a Gemini key and some input before calling Gemini", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    vi.stubEnv("GEMINI_API_KEY", "");
    expect((await call(form({ text: "CSE 240 MW 10:30-11:45" }))).status).toBe(503);

    vi.stubEnv("GEMINI_API_KEY", "test-key");
    expect((await call(form({}))).status).toBe(400);
    expect((await call(form({ text: "   " }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns only well-formed classes from Gemini's answer", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      geminiAnswer({
        classes: [
          { course: "CSE 240", days: ["Mon", "Wed", "Funday"], start: "10:30", end: "11:45", building: "coor", room: "170" },
          { course: "", days: ["Tue"], start: "09:00", end: "09:50", building: "", room: "" },
          { course: "MAT 343", days: ["Tue"], start: "9am", end: "10:15", building: "", room: "" },
          { course: "ENG 102", days: ["Thu"], start: "13:30", end: "14:45", building: "", room: "" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await call(form({ text: "my schedule" }))).toEqual({
      status: 200,
      json: {
        classes: [
          { course: "CSE 240", days: ["Mon", "Wed"], start: "10:30", end: "11:45", building: "COOR", room: "170" },
          { course: "ENG 102", days: ["Thu"], start: "13:30", end: "14:45", building: "" },
        ],
      },
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
  });

  it("reports Gemini failures and empty answers", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    expect((await call(form({ text: "schedule" }))).status).toBe(502);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiAnswer({ classes: [] })));
    expect((await call(form({ text: "schedule" }))).status).toBe(422);
  });
});
