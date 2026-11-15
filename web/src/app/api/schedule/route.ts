// POST /api/schedule: turns a photo or pasted text of a class schedule into ClassBlock[] with Gemini.
// Body: multipart form with "image" (a photo or screenshot) and/or "text" (pasted from MyASU).
// Written by B (UI) so setup is easy; calls the Gemini REST API directly, so it adds no dependency.
import type { ClassBlock, Weekday } from "@/lib/types";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest"; // same default as lib/gemini.ts
const DAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const PROMPT = `You read class schedules for Arizona State University students.
Extract every in-person weekly class meeting from the schedule below.
Return one entry per meeting pattern with:
- course: the course code, like "CSE 240"
- days: the weekdays it meets, using only Mon, Tue, Wed, Thu, Fri, Sat, Sun
- start and end: 24-hour local time as HH:MM
- building: the ASU building abbreviation exactly as shown (for example COOR, BYENG, WXLR), or "" if none is shown
- room: the room number, or "" if none is shown
Skip online classes that have no meeting time. Never invent a class that is not in the schedule.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    classes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          course: { type: "STRING" },
          days: { type: "ARRAY", items: { type: "STRING", enum: DAYS } },
          start: { type: "STRING" },
          end: { type: "STRING" },
          building: { type: "STRING" },
          room: { type: "STRING" },
        },
        required: ["course", "days", "start", "end", "building", "room"],
      },
    },
  },
  required: ["classes"],
};

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function clean(raw: unknown): ClassBlock[] {
  if (!Array.isArray(raw)) return [];
  const time = /^\d{2}:\d{2}$/;
  return raw
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      course: String(c.course ?? "").trim().slice(0, 20),
      days: (Array.isArray(c.days) ? c.days : []).filter((d): d is Weekday => DAYS.includes(d as Weekday)),
      start: String(c.start ?? ""),
      end: String(c.end ?? ""),
      building: String(c.building ?? "").trim().toUpperCase().slice(0, 10),
      room: String(c.room ?? "").trim().slice(0, 10) || undefined,
    }))
    .filter((c) => c.course && c.days.length && time.test(c.start) && time.test(c.end))
    .slice(0, 20);
}

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return error("Schedule reading is not set up yet: GEMINI_API_KEY is missing on the server.", 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("Send the schedule as a form with an image or text.", 400);
  }

  const parts: object[] = [{ text: PROMPT }];
  const text = form.get("text");
  if (typeof text === "string" && text.trim()) {
    parts.push({ text: `Schedule:\n${text.slice(0, 20000)}` });
  }
  const image = form.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > MAX_IMAGE_BYTES) return error("That photo is over 8 MB. Try a screenshot instead.", 413);
    const data = Buffer.from(await image.arrayBuffer()).toString("base64");
    parts.push({ inlineData: { mimeType: image.type || "image/jpeg", data } });
  }
  if (parts.length === 1) return error("Add a photo of your schedule or paste it as text.", 400);

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
    }),
  });
  if (!res.ok) return error(`Gemini could not read the schedule (status ${res.status}). Try again.`, 502);

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const out = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    const classes = clean((JSON.parse(out) as { classes?: unknown }).classes);
    if (!classes.length) return error("No classes found. Try a clearer photo, or paste the schedule text.", 422);
    return Response.json({ classes });
  } catch {
    return error("No classes found. Try a clearer photo, or paste the schedule text.", 422);
  }
}
