import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A fake Gemini SDK: each test decides what generateContent answers.
const generateContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

async function loadGemini(apiKey: string) {
  vi.resetModules(); // fresh module: empty cache, client created with this key
  vi.stubEnv("GEMINI_API_KEY", apiKey);
  return import("./gemini");
}

beforeEach(() => generateContent.mockReset());
afterEach(() => vi.unstubAllEnvs());

describe("generateJson", () => {
  it("returns null without an API key and never calls Gemini", async () => {
    const { generateJson } = await loadGemini("");
    expect(await generateJson("hi", {})).toBeNull();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("parses JSON, sends the schema and a timeout, and caches identical prompts", async () => {
    const { generateJson } = await loadGemini("test-key");
    generateContent.mockResolvedValue({ text: '{"briefing":"Hello"}' });

    expect(await generateJson("p", { type: "object" })).toEqual({ briefing: "Hello" });
    expect(await generateJson("p", { type: "object" })).toEqual({ briefing: "Hello" });

    expect(generateContent).toHaveBeenCalledTimes(1);
    const { config } = generateContent.mock.calls[0][0];
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseJsonSchema).toEqual({ type: "object" });
    expect(config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("does not cache answers that fail validation", async () => {
    const { generateJson } = await loadGemini("test-key");
    generateContent.mockResolvedValueOnce({ text: '{"picks":"oops"}' }).mockResolvedValueOnce({ text: '{"picks":[]}' });
    const isValid = (v: unknown) => Array.isArray((v as { picks?: unknown }).picks);

    expect(await generateJson("p", {}, isValid)).toBeNull();
    expect(await generateJson("p", {}, isValid)).toEqual({ picks: [] });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("returns null on errors, empty answers and broken JSON", async () => {
    const { generateJson } = await loadGemini("test-key");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    generateContent.mockRejectedValueOnce(new Error("quota")).mockResolvedValueOnce({ text: undefined }).mockResolvedValueOnce({ text: "{not json" });

    expect(await generateJson("a", {})).toBeNull();
    expect(await generateJson("b", {})).toBeNull();
    expect(await generateJson("c", {})).toBeNull();
    warn.mockRestore();
  });
});
