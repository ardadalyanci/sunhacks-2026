import { describe, expect, it, vi } from "vitest";
import { createShared, newestWins } from "./loading";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("newestWins", () => {
  it("drops an older answer that lands late and gives both callers the newest one", async () => {
    const run = newestWins<string>();
    const apply = vi.fn();
    const fail = vi.fn();
    const older = deferred<string>();
    const newer = deferred<string>();

    const first = run(() => older.promise, apply, fail);
    const second = run(() => newer.promise, apply, fail);
    newer.resolve("plan with both changes");
    older.resolve("plan with the first change only");

    expect(await first).toBe("plan with both changes");
    expect(await second).toBe("plan with both changes");
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith("plan with both changes");
    expect(fail).not.toHaveBeenCalled();
  });

  it("reports only the newest failure and resolves to null", async () => {
    const run = newestWins<string>();
    const apply = vi.fn();
    const fail = vi.fn();
    const older = deferred<string>();

    const first = run(() => older.promise, apply, fail);
    const second = run(() => Promise.reject(new Error("plan failed")), apply, fail);
    older.reject(new Error("old failure"));

    expect(await first).toBeNull();
    expect(await second).toBeNull();
    expect(fail).toHaveBeenCalledTimes(1);
    expect((fail.mock.calls[0][0] as Error).message).toBe("plan failed");
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("createShared", () => {
  it("reuses one load for the same key until it gets old", async () => {
    const shared = createShared<string>(60_000);
    const load = vi.fn().mockResolvedValue("day");

    const a = shared.get("today", load, 0);
    const b = shared.get("today", load, 1_000);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);

    await shared.get("today", load, 61_000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("loads again when the key changes or a load failed", async () => {
    const shared = createShared<string>(60_000);
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue("day");

    await expect(shared.get("today", load, 0)).rejects.toThrow("offline");
    expect(await shared.get("today", load, 1)).toBe("day");
    expect(await shared.get("today+robotics", load, 2)).toBe("day");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("returns a stored newer answer without loading", async () => {
    const shared = createShared<string>(60_000);
    const load = vi.fn().mockResolvedValue("old day");
    shared.set("today+robotics", "day with robotics", 0);
    expect(await shared.get("today+robotics", load, 10)).toBe("day with robotics");
    expect(load).not.toHaveBeenCalled();
  });
});
