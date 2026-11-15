# data/

Owned by Agent-3 (Kerem). Static data the server reads at runtime.

## buildings.json
ASU Tempe buildings the planner uses for walking times and "leave at" markers (`web/src/lib/buildings.ts` loads it).
One JSON array of `{ id, name, lat, lng, aliases? }` (the `Building` type in `web/src/lib/planner.ts`):

```json
{ "id": "BYENG", "name": "Brickyard Engineering", "lat": 33.4236, "lng": -111.93951, "aliases": ["Brickyard"] }
```

- `id` is the ASU building abbreviation students see in MyASU (COOR, BYENG, WXLR…), as in a class location "BYENG 210".
- A class or event location matches a building when its id, name or an alias appears as whole words
  ("BYENG 210", "Hayden Library C12", "Manzanita"); the longest match wins.
- Coordinates are building centroids from OpenStreetMap (© OpenStreetMap contributors, ODbL), pulled once on
  Nov 14 2026 with this Overpass query, then picked and coded by hand:

```
[out:json][timeout:60];
(way["building"]["name"](33.405,-111.945,33.430,-111.918);
 relation["building"]["name"](33.405,-111.945,33.430,-111.918););
out center tags;
```

  OSM has no "Language and Literature" building; LL is Durham Hall, so it uses Durham Hall's centroid.

To add a building: run the query at https://overpass-turbo.eu, copy the `center` of the right way, and add an entry
with the ASU code as `id` and any names students actually say.
