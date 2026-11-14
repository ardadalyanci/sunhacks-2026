import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanClasses } from "./clean";
import { POST } from "./route";

function form(fields: Record<string, string | Blob>) {
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
    expect((await call(form({ image: new Blob(["not an image"], { type: "text/plain" }) }))).status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns only well-formed classes from Gemini's answer", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      geminiAnswer({
        classes: [
          { course: "CSE 240", days: ["Mon", "Wed", "Funday"], start: "10:30", end: "11:45", location: "COOR 170" },
          { course: "", days: ["Tue"], start: "09:00", end: "09:50", location: "" },
          { course: "MAT 343", days: ["Tue"], start: "9am", end: "10:15", location: "" },
          { course: "ENG 102", days: ["Thu"], start: "13:30", end: "14:45", location: "" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await call(form({ text: "my schedule" }));
    expect(result).toEqual({
      status: 200,
      json: {
        classes: [
          { course: "CSE 240", days: ["Mon", "Wed"], start: "10:30", end: "11:45", location: "COOR 170" },
          { course: "ENG 102", days: ["Thu"], start: "13:30", end: "14:45" },
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

describe("cleanClasses", () => {
  it("drops impossible times and non-objects", () => {
    expect(
      cleanClasses([
        null,
        "CSE 240",
        { course: "CSE 230", days: ["Mon"], start: "25:00", end: "26:00" },
        { course: "CSE 230", days: ["Mon"], start: "11:00", end: "10:00" },
      ]),
    ).toEqual([]);
    expect(cleanClasses("nope")).toEqual([]);
  });
});
