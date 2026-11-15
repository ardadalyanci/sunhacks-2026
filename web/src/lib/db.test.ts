import { afterEach, describe, expect, it, vi } from "vitest";

const connect = vi.fn();
vi.mock("mongodb", () => ({ MongoClient: class { connect = connect; } }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getDb", () => {
  it("returns null without MONGODB_URI and never connects", async () => {
    vi.stubEnv("MONGODB_URI", "");
    const { getDb } = await import("./db");
    expect(await getDb()).toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it("returns null when Atlas is unreachable, then waits a minute before trying again", async () => {
    vi.stubEnv("MONGODB_URI", "mongodb+srv://example.invalid/test");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    connect.mockRejectedValue(new Error("Server selection timed out after 1500 ms"));
    const { getDb } = await import("./db");
    expect(await getDb()).toBeNull();
    expect(await getDb()).toBeNull();
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
