// A small iCalendar (RFC 5545) reader and writer, enough for the SunDevilCentral feed and our own ICS export.
// No dependency: the feed only needs VEVENT blocks with text, date and CATEGORIES properties.

export interface IcsProperty {
  name: string; // upper case, e.g. "DTSTART"
  params: Record<string, string>; // upper-case keys, e.g. { TZID: "America/Phoenix" }
  value: string; // raw value, not yet unescaped
}

export interface IcsEvent {
  uid?: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  start?: Date;
  end?: Date;
  allDay: boolean;
  /** CATEGORIES grouped by their X-CG-CATEGORY parameter ("club_acronym", "event_type", "event_tags"); plain ones under "". */
  categories: Record<string, string[]>;
  organizer?: string;
}

/** Joins folded lines (a line that starts with a space or tab continues the previous one). */
export function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) out[out.length - 1] += line.slice(1);
    else if (line) out.push(line);
  }
  return out;
}

/** Splits `NAME;P1=a;P2="b;c":value` into its parts. Quoted parameter values may hold ; and :. */
export function parseLine(line: string): IcsProperty | null {
  let i = 0;
  let inQuotes = false;
  let colon = -1;
  const cuts: number[] = [];
  for (; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ";") cuts.push(i);
    else if (!inQuotes && ch === ":") {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const pieces: string[] = [];
  let from = 0;
  for (const c of cuts) {
    pieces.push(head.slice(from, c));
    from = c + 1;
  }
  pieces.push(head.slice(from));
  const [name, ...rawParams] = pieces;
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

/** Undoes RFC 5545 text escaping: \n, \, \; \\ . */
export function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

/** Decodes quoted-printable (=C3=A9 → é, soft line breaks removed) as UTF-8. */
export function decodeQuotedPrintable(value: string): string {
  const soft = value.replace(/=\r?\n/g, "");
  if (!/=[0-9A-F]{2}/i.test(soft)) return soft;
  const bytes: number[] = [];
  for (let i = 0; i < soft.length; i++) {
    const hex = soft.slice(i + 1, i + 3);
    if (soft[i] === "=" && /^[0-9A-F]{2}$/i.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(...new TextEncoder().encode(soft[i]));
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function textOf(p: IcsProperty): string {
  const raw = p.params.ENCODING?.toUpperCase() === "QUOTED-PRINTABLE" ? decodeQuotedPrintable(p.value) : p.value;
  return unescapeText(raw).trim();
}

/**
 * DTSTART / DTEND → Date. "20261116T190000Z" is UTC. A floating or TZID time is read as Arizona time
 * (UTC-07:00, no daylight saving): every feed we read is for ASU. "20261116" (VALUE=DATE) is midnight Arizona.
 */
export function parseIcsDate(p: IcsProperty): { date: Date; allDay: boolean } | undefined {
  const m = p.value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) return { date: new Date(`${y}-${mo}-${d}T00:00:00-07:00`), allDay: true };
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s ?? "00"}${z ? "Z" : "-07:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : { date, allDay: false };
}

/** Every VEVENT in an .ics file. Broken events are skipped, never thrown. */
export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: IcsEvent | null = null;
  let depth = 0; // nested blocks inside a VEVENT (VALARM) are ignored
  for (const line of unfold(text)) {
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === "BEGIN") {
      if (p.value.trim().toUpperCase() === "VEVENT" && !current) current = { summary: "", allDay: false, categories: {} };
      else if (current) depth++;
      continue;
    }
    if (p.name === "END") {
      if (current && depth > 0) depth--;
      else if (current && p.value.trim().toUpperCase() === "VEVENT") {
        events.push(current);
        current = null;
      }
      continue;
    }
    if (!current || depth > 0) continue;
    switch (p.name) {
      case "UID":
        current.uid = p.value.trim();
        break;
      case "SUMMARY":
        current.summary = textOf(p);
        break;
      case "DESCRIPTION":
        current.description = textOf(p);
        break;
      case "LOCATION":
        current.location = textOf(p);
        break;
      case "URL":
        current.url = p.value.trim();
        break;
      case "ORGANIZER":
        current.organizer = p.params.CN;
        break;
      case "DTSTART": {
        const d = parseIcsDate(p);
        if (d) {
          current.start = d.date;
          current.allDay = d.allDay;
        }
        break;
      }
      case "DTEND": {
        const d = parseIcsDate(p);
        if (d) current.end = d.date;
        break;
      }
      case "CATEGORIES": {
        const group = p.params["X-CG-CATEGORY"] ?? "";
        const values = textOf(p)
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        (current.categories[group] ??= []).push(...values);
        break;
      }
    }
  }
  return events;
}

// ---------- writing ----------

/** Escapes text for an ICS property value. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets (UTF-8), as RFC 5545 asks. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (size + n > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Date → "20261116T190000Z". */
export function icsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
