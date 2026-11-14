import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasError, fetchDeadlines, shortCourse } from "./canvas";

// CANVAS_BASE_URL is https://canvas.test (see vitest.config.mts).
const BASE = "https://canvas.test";

function reply(body: unknown, init: { status?: number; link?: string } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: init.link ? { link: init.link, "content-type": "application/json" } : { "content-type": "application/json" },
  });
}

const assignment = {
  plannable_type: "assignment",
  plannable_id: 11,
  plannable_date: "2026-11-17T06:59:00Z",
  context_name: "CSE 230: Computer Org (2026 Fall)",
  html_url: "/courses/1/assignments/11",
  plannable: { title: "Lab 7", due_at: "2026-11-17T06:59:00Z" },
  submissions: { submitted: false },
};

afterEach(() => vi.unstubAllGlobals());

describe("fetchDeadlines", () => {
  it("maps planner items to deadlines in Arizona time with submitted status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      reply([
        assignment,
        { ...assignment, plannable_id: 12, plannable: { title: "HW 9", due_at: "2026-11-17T06:59:00Z" }, submissions: { submitted: true } },
        { ...assignment, plannable_id: 13, plannable_type: "quiz", submissions: false, planner_override: { marked_complete: true } },
        { ...assignment, plannable_id: 14, plannable_type: "announcement" }, // not a deadline
        { ...assignment, plannable_id: 15, plannable: { title: "No date" }, plannable_date: undefined }, // dropped
        { ...assignment, plannable_id: 16, plannable: { title: "Bad date", due_at: "tbd" }, plannable_date: undefined }, // dropped
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchDeadlines("secret-token", "2026-11-16");

    expect(items.map((i) => [i.id, i.title, i.start, i.done])).toEqual([
      ["canvas-assignment-11", "CSE 230: Lab 7", "2026-11-16T23:59:00-07:00", false],
      ["canvas-assignment-12", "CSE 230: HW 9", "2026-11-16T23:59:00-07:00", true],
      ["canvas-quiz-13", "CSE 230: Lab 7", "2026-11-16T23:59:00-07:00", true],
    ]);
    expect(items[0].url).toBe(`${BASE}/courses/1/assignments/11`);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(`${BASE}/api/v1/planner/items?`);
    expect(String(url)).toContain("start_date=2026-11-16T00%3A00%3A00-07%3A00");
    expect(String(url)).toContain("end_date=2026-11-18T00%3A00%3A00-07%3A00");
    expect(init.headers.Authorization).toBe("Bearer secret-token");
  });

  it("follows pagination on the Canvas host only", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply([assignment], { link: `<${BASE}/api/v1/planner/items?page=2>; rel="next"` }))
      .mockResolvedValueOnce(reply([{ ...assignment, plannable_id: 21 }], { link: `<https://evil.example/steal>; rel="next"` }));
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchDeadlines("secret-token", "2026-11-16");

    expect(items).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2); // the foreign "next" link is never requested
    for (const [url] of fetchMock.mock.calls) expect(String(url).startsWith(BASE)).toBe(true);
  });

  it.each([
    [401, 401],
    [403, 403],
    [500, 502],
  ])("turns Canvas status %i into a CanvasError with status %i", async (status, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ errors: [] }, { status })));
    const err = await fetchDeadlines("secret-token-123", "2026-11-16").catch((e) => e);
    expect(err).toBeInstanceOf(CanvasError);
    expect(err.status).toBe(expected);
    expect(err.message).not.toContain("secret-token-123"); // error messages never echo the token
  });

  it("reports timeouts and unexpected bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
    expect((await fetchDeadlines("t", "2026-11-16").catch((e) => e)).status).toBe(504);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ not: "an array" })));
    expect((await fetchDeadlines("t", "2026-11-16").catch((e) => e)).status).toBe(502);
  });
});

describe("shortCourse", () => {
  it.each([
    ["CSE 230: Computer Org (2026 Fall)", "CSE 230"],
    ["2026Fall-T-CSE230-71234", "CSE 230"],
    ["MAT 343", "MAT 343"],
    ["Honors Seminar", "Honors Seminar"],
  ])("%s → %s", (input, expected) => {
    expect(shortCourse(input)).toBe(expected);
  });
});
