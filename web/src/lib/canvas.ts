// Canvas planner items → DayItem deadlines. Server-side only.
// The student's token is passed in per request and never stored or logged.
import type { DayItem } from "./engine-types";
import { addDays, toMstIso } from "./planner";

const CANVAS_BASE = process.env.CANVAS_BASE_URL || "https://canvas.asu.edu";
const DEADLINE_TYPES = new Set(["assignment", "quiz", "discussion_topic", "wiki_page", "sub_assignment"]);
const MAX_PAGES = 5;
const TIMEOUT_MS = 10_000;

// The fields of a planner item we read. https://canvas.instructure.com/doc/api/planner.html
interface PlannerItem {
  plannable_type: string;
  plannable_id: number | string;
  plannable_date?: string;
  context_name?: string;
  html_url?: string;
  plannable?: { title?: string; due_at?: string | null; todo_date?: string | null };
  submissions?: false | { submitted?: boolean; graded?: boolean; excused?: boolean };
  planner_override?: { marked_complete?: boolean } | null;
}

export class CanvasError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Deadlines from `date` up to the end of the next day, so the planner can start tomorrow's work today. */
export async function fetchDeadlines(token: string, date: string): Promise<DayItem[]> {
  const params = new URLSearchParams({
    start_date: `${date}T00:00:00-07:00`,
    end_date: `${addDays(date, 2)}T00:00:00-07:00`,
    per_page: "100",
  });
  let url: string | null = `${CANVAS_BASE}/api/v1/planner/items?${params}`;
  const raw: PlannerItem[] = [];

  // Follow Canvas pagination (Link header), capped so a huge account cannot stall the request.
  for (let page = 0; url && page < MAX_PAGES; page++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new CanvasError("Canvas did not answer in time.", 504);
    }
    if (res.status === 401) throw new CanvasError("Canvas rejected the token. Create a new one in Canvas → Account → Settings.", 401);
    if (res.status === 403) throw new CanvasError("This Canvas token is not allowed to read your planner. Create a new token without scope limits.", 403);
    if (!res.ok) throw new CanvasError(`Canvas answered ${res.status}.`, 502);
    const body: unknown = await res.json().catch(() => null);
    if (!Array.isArray(body)) throw new CanvasError("Canvas sent an unexpected answer.", 502);
    raw.push(...(body as PlannerItem[]));
    // Only ever send the token back to Canvas itself, whatever the Link header says.
    url = sameOrigin(nextLink(res.headers.get("link")));
  }

  return raw.filter((p) => DEADLINE_TYPES.has(p.plannable_type)).map(toDayItem).filter((d): d is DayItem => d !== null);
}

function toDayItem(p: PlannerItem): DayItem | null {
  const when = p.plannable?.due_at ?? p.plannable?.todo_date ?? p.plannable_date;
  const due = when ? new Date(when) : null;
  if (!due || Number.isNaN(due.getTime())) return null;
  const title = p.plannable?.title?.trim() || "Untitled";
  const submitted = p.submissions ? Boolean(p.submissions.submitted || p.submissions.excused) : false;
  return {
    id: `canvas-${p.plannable_type}-${p.plannable_id}`,
    type: "deadline",
    title: p.context_name ? `${shortCourse(p.context_name)}: ${title}` : title,
    start: toMstIso(due),
    source: "canvas",
    done: submitted || Boolean(p.planner_override?.marked_complete),
    url: sameOrigin(p.html_url ? new URL(p.html_url, CANVAS_BASE).toString() : null) ?? undefined,
  };
}

/**
 * Short course label for the timeline: "CSE 230: Computer Org (2026 Fall)" and
 * "2026Fall-T-CSE230-71234" both become "CSE 230". Names without a course code stay as they are.
 */
export function shortCourse(name: string): string {
  const m = name.match(/\b([A-Z]{2,4})\s?(\d{3}[A-Z]?)\b/);
  return m ? `${m[1]} ${m[2]}` : name;
}

function nextLink(link: string | null): string | null {
  if (!link) return null;
  const next = link.split(",").find((part) => part.includes('rel="next"'));
  const m = next?.match(/<([^>]+)>/);
  return m ? m[1] : null;
}

/** The URL if it points at the configured Canvas host, otherwise null. */
function sameOrigin(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin === new URL(CANVAS_BASE).origin ? url : null;
  } catch {
    return null;
  }
}
