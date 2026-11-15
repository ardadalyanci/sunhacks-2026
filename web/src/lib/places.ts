// ASU Tempe buildings in the words students use, shared by the server (Sol's briefing) and the UI (leave times).
import raw from "./buildings.json";

type Building = { id: string; name: string; lat: number; lng: number; aliases?: string[] };
const BUILDINGS = raw as Building[];

/** The building a location like "BYENG 210" or "Hayden Library" is in, and the room if one was given. */
export function findPlace(location: string | undefined): { building?: Building; room: string } {
  if (!location) return { room: "" };
  const [first, ...rest] = location.trim().split(/\s+/);
  const byId = BUILDINGS.find((b) => b.id.toLowerCase() === first.toLowerCase());
  if (byId) return { building: byId, room: rest.join(" ") };
  const lower = location.toLowerCase();
  const byName = BUILDINGS.find((b) => [b.name, ...(b.aliases ?? [])].some((n) => lower.startsWith(n.toLowerCase())));
  if (!byName) return { room: "" };
  const name = [byName.name, ...(byName.aliases ?? [])].find((n) => lower.startsWith(n.toLowerCase()))!;
  return { building: byName, room: location.trim().slice(name.length).trim() };
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

/** "Brickyard 210", "the MU 230", "Hayden": a location in the words a student would use. */
export function placeLabel(location: string | undefined): string {
  const { building, room } = findPlace(location);
  if (!building) return location ?? "";
  const word = buildingWord(building);
  return room ? `${word} ${room}` : word;
}

/** Google Maps walking directions to the building (or to the place's name in Tempe). */
export function walkLink(location: string | undefined): string {
  const { building } = findPlace(location);
  const destination = building ? `${building.lat},${building.lng}` : `${location ?? ""}, Tempe, AZ`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`;
}

// Building codes as whole words ("BYENG 210"), for swapping them for spoken names in Sol's lines.
const CODE = new RegExp(`\\b(${BUILDINGS.map((b) => b.id).join("|")})\\b`, "g");

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
    .replace(/\b12 pm\b/g, "noon")
    .replace(CODE, (code) => {
      const building = BUILDINGS.find((b) => b.id === code);
      return building ? buildingWord(building) : code;
    })
    .replace(/\b(?:the\s+){2,}/gi, "the ") // "at the the MU" when the model adds its own "the"
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/!+/g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}
