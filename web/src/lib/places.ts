// ASU Tempe buildings in the words students use, shared by the server (Sol's briefing) and the UI (leave times).
import raw from "./buildings.json";
import otherCampuses from "./campus-buildings.json";
import type { CampusId } from "./types";

type Building = { id: string; name: string; lat: number; lng: number; aliases?: string[] };
const BUILDINGS = raw as Building[];

// What may sit between a building and its room: "MU 202", "MU-242", "MU #230", "Hayden Library, 2nd floor".
const ROOM_GAP = /^[\s\-#,]+/;

// An official building code in parentheses, as ASU's feeds write it: "Life Sciences Center E (LSE), Room 104".
const PAREN_CODE = /\(([A-Z]{2,6})\)/;

/**
 * The room part, the way students say it: without the gap, without the building's code said a second time
 * ("Memorial Union - MU 085 Union Stage" → "085 Union Stage") and without the word "Room" ("Room 104" → "104").
 */
function roomPart(building: Building, rest: string): string {
  return rest
    .replace(ROOM_GAP, "")
    .replace(new RegExp(`^${building.id}(?![a-z0-9])[\\s\\-#,]*`, "i"), "")
    .replace(/^room\s+(?=\S)/i, "")
    .trim();
}

/** The building a location like "BYENG 210", "MU-242" or "Hayden Library" is in, and the room if one was given. */
export function findPlace(location: string | undefined): { building?: Building; room: string } {
  const text = location?.trim();
  if (!text) return { room: "" };
  const m = /^([A-Za-z]+\d*)(.*)$/.exec(text);
  const first = m?.[1] ?? "";
  const rest = m?.[2] ?? text;
  const byId = (!rest || ROOM_GAP.test(rest)) && BUILDINGS.find((b) => b.id.toLowerCase() === first.toLowerCase());
  if (byId) return { building: byId, room: roomPart(byId, rest) };
  // A code in parentheses names the building better than the words before it: "Life Sciences Center" alone is
  // the A wing, but "Life Sciences Center E (LSE)" is the E wing.
  const paren = PAREN_CODE.exec(text);
  const coded = paren && BUILDINGS.find((b) => b.id === paren[1]);
  if (paren && coded) return { building: coded, room: roomPart(coded, text.slice(paren.index + paren[0].length)) };
  // A name or alias counts only as whole words: "MU" starts "MU-242" but not "Mustang Hall".
  const lower = text.toLowerCase();
  const starts = (n: string) => lower.startsWith(n.toLowerCase()) && !/[a-z0-9]/.test(lower.charAt(n.length));
  const byName = BUILDINGS.find((b) => [b.name, ...(b.aliases ?? [])].some(starts));
  if (!byName) return { room: "" };
  const name = [byName.name, ...(byName.aliases ?? [])].find(starts)!;
  if (paren) {
    // An unknown code right after the name is another code for the same building ("Student Pavilion (STPV)");
    // after more words it names a wing we do not know ("Life Sciences Center C (LSC)"), so the place stays as given.
    if (text.slice(name.length, paren.index).replace(ROOM_GAP, "").trim()) return { room: "" };
    return { building: byName, room: roomPart(byName, text.slice(paren.index + paren[0].length)) };
  }
  return { building: byName, room: roomPart(byName, text.slice(name.length)) };
}

// What students call a building when the official name is long: Brickyard, Coor Hall, the MU, Hayden, and the
// codes they actually say (PSF, ERC, LL, SDFC).
const SPOKEN: Record<string, string> = {
  MU: "the MU",
  LIB: "Hayden",
  MANZ: "Manzanita",
  TOOKR: "Tooker",
  PSB: "PSB",
  PSF: "PSF",
  PSH: "PSH",
  ECA: "ECA",
  ECG: "ECG",
  ERC: "ERC",
  LL: "LL",
  LSA: "LSA",
  LSE: "LSE",
  SDFC: "SDFC",
};

/** The word students use for a building: its short alias, or a nickname from SPOKEN. */
export function buildingWord(building: Building): string {
  const alias = building.aliases?.[0];
  return SPOKEN[building.id] ?? (alias && alias.length < building.name.length ? alias : building.name);
}

/** "Brickyard 210", "MU 230", "the MU", "Hayden": a location in the words a student would use. */
export function placeLabel(location: string | undefined): string {
  const { building, room } = findPlace(location);
  if (!building) return location ?? "";
  return room ? withRoom(buildingWord(building), room) : buildingWord(building);
}

/** Students say "the MU" but "MU 202": a room number drops the "the". */
function withRoom(word: string, room: string): string {
  return `${word.replace(/^the /, "")} ${room}`;
}

// The other campuses' buildings (lib/campus-buildings.json) and the city each campus is in.
const OTHER = otherCampuses as (Building & { campus: CampusId })[];
const CITY: Record<CampusId, string> = { tempe: "Tempe", downtown: "Phoenix", polytechnic: "Mesa", west: "Glendale" };

/** A building on Downtown, Polytechnic or West Valley whose name or alias starts the location ("Santan Hall 120"). */
function otherCampusBuilding(location: string, campus: CampusId): Building | undefined {
  const lower = location.trim().toLowerCase();
  const starts = (n: string) => lower.startsWith(n.toLowerCase()) && !/[a-z0-9]/.test(lower.charAt(n.length));
  return OTHER.find((b) => b.campus === campus && [b.name, ...(b.aliases ?? [])].some(starts));
}

/** Google Maps walking directions to the building (or to the place's name in the campus's city). */
export function walkLink(location: string | undefined, campus: CampusId = "tempe"): string {
  const building = campus === "tempe" ? findPlace(location).building : otherCampusBuilding(location ?? "", campus);
  const destination = building ? `${building.lat},${building.lng}` : `${location ?? ""}, ${CITY[campus]}, AZ`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`;
}

// A Canvas title as lib/canvas.ts writes it: "CSE 230: Lab 7 (pipelining)".
const COURSE_TITLE = /^([A-Z]{2,4} \d{3}[A-Z]?):\s*(.+)$/;

/**
 * An assignment the way a student says it out loud: "Lab 7 for CSE 230", "the Reading response for ENG 102".
 * A numbered name reads like a proper name; anything else gets "the". Titles without a course code stay as
 * they are. The same idea as assignmentName in components/sky-layout.ts, which server code must not import.
 */
export function spokenAssignment(title: string): string {
  const m = COURSE_TITLE.exec(title.trim());
  if (!m) return title.trim();
  const name = m[2].replace(/\s*\([^)]*\)/g, "").trim() || m[2].trim();
  const article = /\d/.test(name) || /^the\b/i.test(name) ? "" : "the ";
  return `${article}${name} for ${m[1]}`;
}

/** "Study group: MAT 343" → "MAT 343 study group", the way a student says it; other titles stay as they are. */
export function spokenStop(title: string): string {
  const m = /^([A-Za-z][A-Za-z ]*?):\s*([A-Z]{2,4} \d{3}[A-Z]?)$/.exec(title.trim());
  return m ? `${m[2]} ${m[1].toLowerCase()}` : title.trim();
}

// Building ids that are also ASU course prefixes: "PSY 101" is a class, not the Psychology Building, so these are
// never swapped (every place in Sol's prompts already goes through placeLabel, so nothing is lost).
const COURSE_PREFIXES = new Set(["PSY", "ART", "BA", "ED", "SS", "MUSIC"]);

// Building codes as whole words ("BYENG 210"), for swapping them for spoken names in Sol's lines.
const CODE = new RegExp(`\\b(${BUILDINGS.map((b) => b.id).filter((id) => !COURSE_PREFIXES.has(id)).join("|")})\\b`, "g");

/**
 * Sol's written and spoken lines in the app's own style: "10:13 am" not "10:13 AM", "8 am" not "8:00 am",
 * "noon", no exclamation marks or em dashes, and building codes as the names students say.
 */
export function polishLine(text: string): string {
  const lower = (_: string, time: string, letter: string) => `${time} ${letter.toLowerCase()}m`;
  return text
    .replace(/\b([AaPp])\.[Mm]\./g, "$1M") // a.m. → AM
    .replace(/\b(\d{1,2}:\d{2})\s?([AaPp])[Mm]\b/g, lower) // 10:13 AM → 10:13 am
    .replace(/\b(\d{1,2})(?::00)?\s?([AaPp])[Mm]\b/g, lower) // 8:00 am, 8 AM → 8 am
    .replace(/(^|[^:\d])12 pm\b/g, "$1noon") // "12 pm" is noon; the 12 in "4:12 pm" is not
    .replace(CODE, (code: string, _id: string, at: number, line: string) => {
      const building = BUILDINGS.find((b) => b.id === code);
      if (!building) return code;
      const word = buildingWord(building);
      return /^\s*\d/.test(line.slice(at + code.length)) ? word.replace(/^the /, "") : word; // "MU 202", "the MU"
    })
    .replace(/\b(?:the\s+){2,}/gi, "the ") // "at the the MU" when the model adds its own "the"
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/!+/g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}
