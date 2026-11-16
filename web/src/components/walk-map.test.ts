import { describe, expect, it } from "vitest";
import raw from "@/lib/buildings.json";
import { demoClasses } from "@/lib/demo";
import { addLeaveTimes, classItems, sortByStart, walkMinutes, type Building } from "@/lib/planner";
import type { DayItem } from "@/lib/types";
import { fitBounds, legCurve, markers, placeLabels, project, tilesFor, toWorld, walkLegs, walkSummary } from "./walk-map";

const buildings = raw as Building[];
const byId = (id: string) => buildings.find((b) => b.id === id)!;
const MONDAY = "2026-11-16";
const SIZE = { width: 340, height: 250 };

/** The sample student's Monday, planned by the real planner: CSE 230 in BYENG, PHY 121 in PSF, CSE 240 in BYENG. */
function sampleMonday(hot = false): DayItem[] {
  const items = sortByStart(classItems(demoClasses(MONDAY), MONDAY, buildings));
  addLeaveTimes(items, buildings, "Manzanita", hot ? { tempF: 104, highF: 109, isHot: true } : undefined);
  return items;
}

const item = (id: string, start: string, leaveAt: string | undefined, location: string, type: DayItem["type"] = "class"): DayItem => ({
  id,
  type,
  title: id,
  start: `${MONDAY}T${start}:00-07:00`,
  leaveAt: leaveAt && `${MONDAY}T${leaveAt}:00-07:00`,
  location,
  source: "manual",
});

describe("walkLegs", () => {
  it("walks the sample Monday from Manzanita with the plan's own minutes", () => {
    const { stops, legs } = walkLegs(sampleMonday(), MONDAY, "Manzanita");
    expect(stops.map((s) => `${s.number} ${s.place.word}`)).toEqual(["1 Manzanita", "2 Brickyard", "3 PSF", "4 Brickyard"]);
    expect(legs.map((l) => `${l.from.word} → ${l.to.word}`)).toEqual(["Manzanita → Brickyard", "Brickyard → PSF", "PSF → Brickyard"]);
    expect(legs.map((l) => l.minutes)).toEqual([
      walkMinutes(byId("MANZ"), byId("BYENG"), false),
      walkMinutes(byId("BYENG"), byId("PSF"), false),
      walkMinutes(byId("PSF"), byId("BYENG"), false),
    ]);
    expect(legs[0].leaveAt).toMatch(/^2026-11-16T10:\d\d:00-07:00$/);
    expect(legs.map((l) => l.toNumber)).toEqual([2, 3, 4]);
    // Brickyard is visited twice but is one marker with both numbers.
    expect(markers(stops).map((m) => `${m.place.word} ${m.numbers.join(",")}`)).toEqual(["Manzanita 1", "Brickyard 2,4", "PSF 3"]);
  });

  it("says how many walks and minutes, and mentions the heat on hot days", () => {
    const { legs } = walkLegs(sampleMonday(), MONDAY, "Manzanita");
    const total = legs.reduce((s, l) => s + l.minutes, 0);
    expect(walkSummary(legs, false)).toBe(`3 walks, ${total} minutes on foot.`);
    const hot = walkLegs(sampleMonday(true), MONDAY, "Manzanita").legs;
    expect(hot.reduce((s, l) => s + l.minutes, 0)).toBe(total + 6); // the planner adds 2 minutes per walk in heat
    expect(walkSummary(hot, true)).toMatch(/^3 walks, \d+ minutes on foot, with extra minutes for the heat\.$/);
    expect(walkSummary(legs.slice(0, 1), false)).toMatch(/^1 walk, \d+ minutes on foot\.$/);
  });

  it("merges two stops in a row at one building and draws no walk between them", () => {
    const { stops, legs } = walkLegs(
      [item("a", "10:00", "09:50", "BYENG 210"), item("b", "11:00", "10:57", "Brickyard 190"), item("c", "12:00", "11:48", "Hayden Library")],
      MONDAY,
      "MANZ",
    );
    expect(stops.map((s) => s.place.id)).toEqual(["MANZ", "BYENG", "LIB"]);
    expect(stops[1].itemIds).toEqual(["a", "b"]);
    expect(legs.map((l) => `${l.from.id}-${l.to.id} ${l.minutes}`)).toEqual(["MANZ-BYENG 10", "BYENG-LIB 12"]);
  });

  it("skips a place it cannot find without breaking the order", () => {
    const { stops, legs } = walkLegs(
      [
        item("c", "13:00", "12:50", "PSF 166"),
        item("a", "09:00", "08:45", "COOR 170"),
        item("b", "11:00", "10:50", "Somewhere off campus"),
        item("d", "15:00", "14:50", "MU 230", "event"),
        item("due", "16:00", undefined, "", "deadline"),
        item("other-day", "17:00", "16:50", "LL 101"),
      ].map((i) => (i.id === "other-day" ? { ...i, start: "2026-11-17T17:00:00-07:00" } : i)),
      MONDAY,
    );
    // No start building: the first class is stop 1 and has no walk into it.
    expect(stops.map((s) => `${s.number} ${s.place.id}`)).toEqual(["1 COOR", "2 PSF", "3 MU"]);
    expect(legs.map((l) => `${l.from.id}-${l.to.id} ${l.itemId}`)).toEqual(["COOR-PSF c", "PSF-MU d"]);
  });

  it("finds nothing to draw on a day with no located walks", () => {
    expect(walkLegs([item("a", "10:00", "09:50", "Online")], MONDAY, "MANZ").legs).toEqual([]);
  });
});

describe("walkLegs with rides", () => {
  it("keeps a stop reached by shuttle or from home on the map, without drawing that trip as a walk", () => {
    const day = [
      { ...item("a", "10:30", "10:05", "BYENG 210"), via: "From home by car: about 25 minutes, your own estimate." },
      item("b", "12:00", "11:50", "COOR 170"),
    ];
    const { stops, legs } = walkLegs(day, MONDAY);
    expect(stops.map((s) => s.place.word)).toEqual(["Brickyard", "Coor Hall"]);
    expect(legs.map((l) => l.itemId)).toEqual(["b"]);
  });
});

describe("tiles", () => {
  it("finds the tile that holds a known point", () => {
    // Manzanita Hall, 33.42247 N, 111.93007 W, at zoom 16 (2^16 = 65536 tiles across):
    //   x = (-111.93007 + 180) / 360 * 65536 = 68.06993 / 360 * 65536 = 12391.75 → column 12391
    //   y = (1 - ln(tan(33.42247°) + sec(33.42247°)) / π) / 2 * 65536
    //     = (1 - ln(0.65994 + 1.19813) / π) / 2 * 65536 = (1 - 0.61954 / π) / 2 * 65536 = 26305.96 → row 26305
    const w = toWorld(33.42247, -111.93007);
    expect(Math.floor(w.x * 65536)).toBe(12391);
    expect(Math.floor(w.y * 65536)).toBe(26305);
    // And the map's tile list for a day around Manzanita includes that tile, drawn under the dot.
    const stops = [{ place: { id: "MANZ", word: "Manzanita", lat: 33.42247, lng: -111.93007 } }];
    const bounds = fitBounds(stops);
    const { z, tiles } = tilesFor(bounds, SIZE);
    const dot = project(33.42247, -111.93007, bounds, SIZE);
    const under = tiles.find((t) => dot.x >= t.left && dot.x < t.left + t.size && dot.y >= t.top && dot.y < t.top + t.size)!;
    expect(under).toBeDefined();
    expect(under.x).toBe(Math.floor(w.x * 2 ** z));
    expect(under.y).toBe(Math.floor(w.y * 2 ** z));
  });

  it("covers the whole map with at most 12 tiles", () => {
    for (const ids of [["MANZ"], ["MANZ", "BYENG", "PSF"], ["SDFC", "BYENG", "MANZ", "COOR"]]) {
      const bounds = fitBounds(ids.map((id) => ({ place: { ...byId(id), word: id } })));
      const { tiles } = tilesFor(bounds, SIZE);
      expect(tiles.length).toBeLessThanOrEqual(12);
      expect(Math.min(...tiles.map((t) => t.left))).toBeLessThanOrEqual(0);
      expect(Math.min(...tiles.map((t) => t.top))).toBeLessThanOrEqual(0);
      expect(Math.max(...tiles.map((t) => t.left + t.size))).toBeGreaterThanOrEqual(SIZE.width);
      expect(Math.max(...tiles.map((t) => t.top + t.size))).toBeGreaterThanOrEqual(SIZE.height);
    }
  });
});

describe("project", () => {
  const inside = (ids: string[]) => {
    const stops = ids.map((id) => ({ place: { ...byId(id), word: id } }));
    const bounds = fitBounds(stops);
    return stops.map((s) => project(s.place.lat, s.place.lng, bounds, SIZE));
  };

  it("keeps a one-building day in the middle, zoomed out to at least 500 m", () => {
    const [dot] = inside(["MANZ"]);
    // Mercator stretches north a little more than south, so "the middle" is true to a hundredth of a unit.
    expect(dot.x).toBeCloseTo(SIZE.width / 2, 2);
    expect(dot.y).toBeCloseTo(SIZE.height / 2, 2);
    const bounds = fitBounds([{ place: { ...byId("MANZ"), word: "Manzanita" } }]);
    expect((bounds.north - bounds.south) * 111_320).toBeGreaterThanOrEqual(499);
  });

  it("puts every dot inside the map, clear of the edge, on a wide day", () => {
    for (const dot of inside(["SDFC", "BYENG", "MANZ", "COOR", "ISTB4"])) {
      expect(dot.x).toBeGreaterThanOrEqual(30);
      expect(dot.x).toBeLessThanOrEqual(SIZE.width - 30);
      expect(dot.y).toBeGreaterThanOrEqual(30);
      expect(dot.y).toBeLessThanOrEqual(SIZE.height - 30);
    }
  });

  it("keeps north up and east right", () => {
    const [byeng, psf] = inside(["BYENG", "PSF"]);
    expect(psf.x).toBeGreaterThan(byeng.x); // PSF is east of Brickyard
    expect(psf.y).toBeGreaterThan(byeng.y); // and a little south
  });
});

describe("drawing", () => {
  it("bends a walk and its way back to opposite sides, so their minutes do not overlap", () => {
    const a = { x: 100, y: 100 };
    const b = { x: 200, y: 120 };
    const there = legCurve(a, b).mid;
    const back = legCurve(b, a).mid;
    expect(Math.hypot(there.x - back.x, there.y - back.y)).toBeGreaterThan(20);
  });

  it("places labels of close buildings on different sides", () => {
    const dots = [
      { at: { x: 100, y: 100 }, radius: 11, text: "Brickyard" },
      { at: { x: 160, y: 104 }, radius: 11, text: "PSF" },
    ];
    const [first, second] = placeLabels(dots, [], SIZE);
    const hit =
      first.box.x < second.box.x + second.box.width &&
      second.box.x < first.box.x + first.box.width &&
      first.box.y < second.box.y + second.box.height &&
      second.box.y < first.box.y + first.box.height;
    expect(hit).toBe(false);
  });

  it("keeps a label inside the map near the right edge", () => {
    const [spot] = placeLabels([{ at: { x: 320, y: 120 }, radius: 11, text: "Manzanita" }], [], SIZE);
    expect(spot.box.x + spot.box.width).toBeLessThanOrEqual(SIZE.width);
    expect(spot.anchor).toBe("end");
  });
});
