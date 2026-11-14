// Canvas planner items → DayItem deadlines. Server-side only.
// The student's token is passed in per request and never stored or logged.
import type { DayItem } from "./types";
import { addDays, toMstIso } from "./planner";

const CANVAS_BASE = process.env.CANVAS_BASE_URL || "https://canvas.asu.edu";
const DEADLINE_TYPES = new Set(["assignment", "quiz", "discussion_topic", "wiki_page", "sub_assignment"]);

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
  for (let page = 0; url && page < 5; page++) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (res.status === 401) throw new CanvasError("Canvas rejected the token. Create a new one in Canvas → Account → Settings.", 401);
    if (!res.ok) throw new CanvasError(`Canvas answered ${res.status}.`, 502);
    raw.push(...((await res.json()) as PlannerItem[]));
    url = nextLink(res.headers.get("link"));
  }

  return raw.filter((p) => DEADLINE_TYPES.has(p.plannable_type)).map(toDayItem).filter((d): d is DayItem => d !== null);
}

function toDayItem(p: PlannerItem): DayItem | null {
  const when = p.plannable?.due_at ?? p.plannable?.todo_date ?? p.plannable_date;
  if (!when) return null;
  const title = p.plannable?.title ?? "Untitled";
  const submitted = p.submissions ? Boolean(p.submissions.submitted || p.submissions.excused) : false;
  return {
    id: `canvas-${p.plannable_type}-${p.plannable_id}`,
    type: "deadline",
    title: p.context_name ? `${shortCourse(p.context_name)}: ${title}` : title,
    start: toMstIso(new Date(when)),
    source: "canvas",
    done: submitted || Boolean(p.planner_override?.marked_complete),
    url: p.html_url ? new URL(p.html_url, CANVAS_BASE).toString() : undefined,
  };
}

/** "CSE 230: Computer Org/Assemb Lang Prog (2026 Fall)" → "CSE 230" when a course code leads the name. */
function shortCourse(name: string): string {
  const m = name.match(/^([A-Z]{2,4}\s?\d{3}[A-Z]?)\b/);
  return m ? m[1] : name;
}

function nextLink(link: string | null): string | null {
  if (!link) return null;
  const next = link.split(",").find((part) => part.includes('rel="next"'));
  const m = next?.match(/<([^>]+)>/);
  return m ? m[1] : null;
}
