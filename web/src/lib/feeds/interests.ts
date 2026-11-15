// Interest taxonomy: maps the interests a student picks in setup to words that show up in the feeds
// (ASU Events "interests", SunDevilCentral event_type / event_tags, titles and descriptions).
// getEvents() adds the matching setup names to Opportunity.tags (first, so they survive tag limits), so the planner's overlap ranking
// and Gemini both see "Robotics" on a "Drone club build night" even when the feed never says "robotics".

/** Setup interest → whole-word patterns (case-insensitive). Keys match INTERESTS in app/setup/page.tsx. */
export const INTEREST_KEYWORDS: Record<string, string[]> = {
  robotics: ["robotics?", "robots?", "drones?", "rov", "mechatronics", "arduino", "autonomous", "rockets?", "propulsion", "vex"],
  software: ["software", "coding", "programming", "developers?", "web dev(elopment)?", "apps?", "computer science", "cs", "ai", "machine learning", "data science", "cybersecurity", "github", "python", "javascript"],
  hackathons: ["hackathons?", "hack night", "devfest", "sunhacks", "game jam", "build night", "codefest"],
  career: ["careers?", "internships?", "recruit(ing|ment|er|ers)?", "employers?", "resumes?", "interview(s|ing)?", "networking", "job fair", "info(rmation)? sessions?", "professional development", "career development"],
  soccer: ["soccer", "futbol", "fútbol"],
  sports: ["sports?", "athletics?", "athletic/sports", "intramurals?", "basketball", "volleyball", "football", "ultimate", "frisbee", "badminton", "tennis", "fitness", "yoga", "climbing", "hik(e|es|ing)", "sun devil fitness"],
  music: ["music", "concerts?", "choirs?", "band", "jazz", "orchestra", "a cappella", "recital", "symphony", "open mic"],
  arts: ["art", "arts", "design", "exhibition", "gallery", "painting", "drawing", "film", "photography", "creative", "museum", "theat(er|re)", "dance", "performance"],
  volunteering: ["volunteer(s|ing)?", "community service", "service project", "civic engagement", "food drive", "donation drive", "community action"],
  startups: ["startups?", "entrepreneur(s|ship)?", "venture", "pitch", "founders?", "venture devils", "business plan"],
  // Added by Agent-2 with the new setup chips (Free food, Cultural nights, Gaming).
  "free food": ["free food", "free pizza", "pizza", "free lunch", "free dinner", "lunch provided", "dinner provided", "food provided", "food will be provided", "snacks", "refreshments", "boba", "tacos"],
  cultural: ["cultural", "culture", "heritage", "international students?", "diwali", "rajyotsava", "lunar new year", "d[ií]a de (los )?muertos", "latin[aox]", "hispanic", "black student", "african", "asian", "south asian", "indian", "korean", "chinese", "vietnamese", "filipino", "arab", "native american", "indigenous", "powwow", "festival"],
  gaming: ["gaming", "video games?", "esports?", "board games?", "game night", "tabletop", "dungeons", "d&d", "smash", "valorant", "league of legends", "minecraft", "nintendo"],
};

const compiled: [string, RegExp][] = Object.entries(INTEREST_KEYWORDS).map(([name, words]) => [
  name,
  new RegExp(`(^|[^\\p{L}\\p{N}])(${words.join("|")})($|[^\\p{L}\\p{N}])`, "iu"),
]);

/** Setup interests whose keywords appear in the text (title, tags, description joined together). */
export function matchInterests(text: string): string[] {
  return compiled.filter(([, re]) => re.test(text)).map(([name]) => name);
}

/** Feed tags that say where or how an event happens rather than what it is about; dropped from interests. */
const NOISE_TAGS = /^(in-person event|online event|hybrid event|tempe campus|downtown phoenix campus|polytechnic campus|west valley campus|west campus|undergraduate|graduate|students|events|asu welcome event|for current asu students|free|open to the public|student organization event|meeting|family-friendly)$/i;

/** Matching setup interests first, then feed tags, without duplicates or location noise. */
export function eventInterests(feedTags: string[], text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of [...matchInterests(text), ...feedTags.map((t) => t.trim())]) {
    const key = tag.toLowerCase();
    if (!tag || NOISE_TAGS.test(tag) || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}
