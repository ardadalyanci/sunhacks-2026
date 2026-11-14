import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Tests must never reach Gemini or Canvas for real.
    env: { GEMINI_API_KEY: "", CANVAS_BASE_URL: "https://canvas.test" },
  },
});
