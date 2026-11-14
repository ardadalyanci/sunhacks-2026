// POST /api/schedule: a photo or pasted text of a class schedule → { classes: ClassBlock[] } via Gemini.
// Body: multipart form with "image" (photo or screenshot) and/or "text" (pasted from MyASU).
// Added by Agent-2 (UI) for the setup screen. lib/gemini.ts takes text prompts only, so this route calls the
// Gemini REST API directly for the image; same env vars (GEMINI_API_KEY, GEMINI_MODEL) and default model.
import type { ClassBlock } from "@/lib/types";
import { DAYS, cleanClasses } from "./clean";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

const PROMPT = `You read class schedules for Arizona State University students.
Extract every in-person weekly class meeting from the schedule below.
Return one entry per meeting pattern with:
- course: the course code, like "CSE 240"
- days: the weekdays it meets, using only Mon, Tue, Wed, Thu, Fri, Sat, Sun
- start and end: 24-hour local time as HH:MM
- location: the building abbreviation and room exactly as shown (for example "BYENG 210" or "COOR 170"), or "" if none is shown
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
          location: { type: "STRING" },
        },
        required: ["course", "days", "start", "end", "location"],
      },
    },
  },
  required: ["classes"],
};

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
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
  if (typeof text === "string" && text.trim()) parts.push({ text: `Schedule:\n${text.slice(0, 20000)}` });
  const image = form.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > MAX_IMAGE_BYTES) return error("That photo is over 8 MB. Try a screenshot instead.", 413);
    if (!image.type.startsWith("image/")) return error("That file is not an image.", 415);
    const data = Buffer.from(await image.arrayBuffer()).toString("base64");
    parts.push({ inlineData: { mimeType: image.type, data } });
  }
  if (parts.length === 1) return error("Add a photo of your schedule or paste it as text.", 400);

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return error("Gemini did not answer in time. Try again, or type your classes in.", 504);
  }
  if (!res.ok) return error(`Gemini could not read the schedule (status ${res.status}). Try again.`, 502);

  const body = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;
  const out = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let classes: ClassBlock[] = [];
  try {
    classes = cleanClasses((JSON.parse(out) as { classes?: unknown }).classes);
  } catch {
    classes = [];
  }
  if (!classes.length) return error("No classes found. Try a clearer photo, or paste the schedule text.", 422);
  return Response.json({ classes });
}
