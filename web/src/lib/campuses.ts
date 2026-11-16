// ASU's four metro campuses. Centres from OpenStreetMap (read Sun Nov 15 2026): the campus areas for
// Polytechnic (way 556494691) and West Valley (way 479433777); Downtown Phoenix has no campus area in OSM, so
// its centre is the University Center building. Tempe keeps the point Sundial has used since day one.
// Used for per-campus weather; shuttles (lib/shuttles.ts) and event filters use the ids.
export const CAMPUSES = ["tempe", "downtown", "polytechnic", "west"] as const;
export type Campus = (typeof CAMPUSES)[number];
export const isCampus = (v: unknown): v is Campus => typeof v === "string" && (CAMPUSES as readonly string[]).includes(v);

export const CAMPUS_INFO: Record<Campus, { name: string; latitude: number; longitude: number }> = {
  tempe: { name: "Tempe", latitude: 33.42, longitude: -111.93 },
  downtown: { name: "Downtown Phoenix", latitude: 33.4530, longitude: -112.0735 },
  polytechnic: { name: "Polytechnic", latitude: 33.3066, longitude: -111.6767 },
  west: { name: "West Valley", latitude: 33.6071, longitude: -112.1599 },
};
