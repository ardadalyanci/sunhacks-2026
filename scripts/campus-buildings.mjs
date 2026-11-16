// Builds web/src/lib/campus-buildings.json: ASU buildings on the Downtown Phoenix, Polytechnic and West Valley
// campuses, from OpenStreetMap (ODbL, © OpenStreetMap contributors). Tempe stays in data/buildings.json.
//
//   node scripts/campus-buildings.mjs                 # asks the Overpass API
//   node scripts/campus-buildings.mjs --from dir/     # reads saved answers: dir/downtown.json, dir/polytechnic.json, dir/west.json
//
// Only the names listed below are kept: the areas around the campuses also hold shops, hotels, airport hangars
// and city buildings. Each entry keeps OpenStreetMap's name and building centre; nothing is typed by hand.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "web", "src", "lib", "campus-buildings.json");

// Centre and radius per campus, and the ASU buildings to keep (exact OpenStreetMap names), with what students say.
const CAMPUSES = {
  downtown: {
    around: [33.452, -112.071, 1000],
    keep: {
      "University Center": [],
      "Walter Cronkite School of Journalism": ["Cronkite"],
      "Nursing and Healthcare Innovation": [],
      "Mercado C": ["Mercado"],
      "Sun Devil Fitness Complex": ["SDFC"],
      "Thunderbird School of Global Management": ["Thunderbird"],
      "Health North": [],
      "Arizona Biomedical Collaborative": [],
      "Westward Ho": [],
    },
  },
  polytechnic: {
    around: [33.3066, -111.6767, 900],
    keep: {
      "Academic Center": [],
      "Administration Building": [],
      "Agribusiness Center": [],
      "Aravaipa Auditorium": ["Aravaipa"],
      "Arizona State University Student Union": ["Student Union"],
      "Century Hall": [],
      "Citrus Dining Pavilion": ["Citrus"],
      "Cooper Hall": [],
      "Engineering Design Studio": [],
      "Interdisciplinary Science and Technology Building (ISTB) 3": ["ISTB 3", "ISTB3"],
      "Interdisciplinary Science and Technology Building 12": ["ISTB 12", "ISTB12"],
      "Lantana Hall": [],
      "Peralta Hall": [],
      "Picacho Hall": [],
      "Santa Catalina Hall": [],
      "Santan Hall": [],
      "Sutton Hall": [],
      "Wanner Hall": [],
      "Technology Center": [],
      "Sun Devil Fitness Complex": ["SDFC"],
      "Student Health Center": [],
      "Bell Residence Hall": [],
      "Falcon Residence Hall": [],
      "Eagle Residence Hall": [],
      "Mustang Residence Hall": [],
      "Phantom Residence Hall": [],
      "Talon Residence Hall": [],
    },
  },
  west: {
    around: [33.6071, -112.1599, 900],
    keep: {
      "Fletcher Library": [],
      "Kiva Lecture Hall": ["Kiva"],
      "Sands Classroom Building": ["Sands"],
      "Faculty/Administration Building": ["FAB"],
      "FAB Annex": [],
      "University Center Building": ["University Center"],
      "Sun Devil Fitness Complex": ["SDFC"],
      "Verde Dining Pavilion": ["Verde"],
      "North Services Building": [],
    },
  },
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function overpass([lat, lng, radius]) {
  const q = `[out:json][timeout:60];(way["building"]["name"](around:${radius},${lat},${lng});relation["building"]["name"](around:${radius},${lat},${lng}););out center tags;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": "Sundial campus buildings script", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: q }),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return res.json();
}

const fromDir = process.argv.includes("--from") ? process.argv[process.argv.indexOf("--from") + 1] : undefined;
const out = [];
for (const [campus, { around, keep }] of Object.entries(CAMPUSES)) {
  const json = fromDir ? JSON.parse(readFileSync(path.join(fromDir, `${campus}.json`), "utf8")) : await overpass(around);
  for (const [name, aliases] of Object.entries(keep)) {
    const e = json.elements.find((x) => x.tags?.name === name && x.center);
    if (!e) {
      console.warn(`missing in OpenStreetMap: ${campus} / ${name}`);
      continue;
    }
    out.push({
      id: `${campus}-${slug(name)}`,
      name,
      lat: Number(e.center.lat.toFixed(5)),
      lng: Number(e.center.lon.toFixed(5)),
      campus,
      ...(aliases.length ? { aliases } : {}),
    });
  }
}
writeFileSync(OUT, "[\n" + out.map((b) => "  " + JSON.stringify(b)).join(",\n") + "\n]\n");
console.log(`wrote ${out.length} buildings to ${path.relative(process.cwd(), OUT)}`);
