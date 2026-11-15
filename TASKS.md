# Tasks

Update this file when you start or finish something. `[ ]` todo, `[~]` in progress (put your name), `[x]` done.
The product changed from "Sunny" to **DayPilot** on Sat afternoon; see CLAUDE.md. The repo scaffold (Next.js 16, shared types, skills) from the first commit stays.

## A: backend 1 + integration (Agent-1, Barış)
- [x] Barış: DayPilot pivot: CLAUDE.md, TASKS.md, README, `DayItem` types
- [x] `web/src/lib/gemini.ts` (Gemini client, server-only, 1 h answer cache, null on failure) — each teammate still needs `GEMINI_API_KEY` in `web/.env.local`
- [x] `POST /api/canvas`: token in body → Canvas planner items → deadline `DayItem[]` with submitted status (never stored or logged)
- [x] `POST /api/plan`: classes + deadlines + events → free gaps, study blocks, leave times, heat (code), event ranking + briefing (Gemini, with code fallbacks) → `DayPlan`
- [x] `POST /api/command`: voice text → `CommandAction` (Gemini, with keyword-rule fallback)
- [ ] Test `/api/plan` and `/api/command` with a real Gemini key (only the fallbacks were tested so far)
- [ ] Switch `lib/buildings.ts` to a static import once `data/buildings.json` exists (needed for deploys)
- [x] Demo mode: `GET /api/demo` (sample student + full day for any date, `hot=1` for a heat day) and Canvas token `demo`; works with no Wi-Fi, token or Gemini
- [ ] Deploy (Vercel or AWS Amplify) + custom domain
- [ ] Stretch: MongoDB Atlas for profiles and event cache

## B: UI (Agent-2, Arda)
- [x] Design plan with the `frontend-design` skill: "Arizona sky" (time of day is color), Bricolage Grotesque + Atkinson Hyperlegible Next, mascot Sol (moods), mobile-first
- [x] Setup screen: Canvas token helper, classes from a photo / pasted MyASU text / by hand, interests (saved in the browser)
- [x] Today screen on the real routes: `/api/demo` → `/api/plan` (sample day), or `/api/canvas` + `/api/events` + `/api/weather` → `/api/plan`; timeline with leave-at chips, due pins, study blocks, events, heat banner, 104°F preview
- [x] Events that fit you: list with "why" from `/api/plan` suggestions, add to my day, RSVP
- [x] Voice: Hear my day (speechSynthesis), mic (Web Speech) + typed box → `/api/command`, add/remove re-plans
- [x] `POST /api/schedule` (new, Agent-2): schedule photo or pasted text → `ClassBlock[]` via Gemini REST, with tests
- [ ] Map view of today's buildings (Leaflet + OpenStreetMap) — needs `data/buildings.json` from C
- [x] Landing page
- [x] PWA: `app/manifest.ts` (installs to the home screen, opens on /today), `app/icon.tsx` + `app/apple-icon.tsx` drawn from Sol
- [ ] Phone pass on the live Vercel URL

## C: backend 2 + data (Agent-3, Kerem)
- [x] Kerem: `GET /api/events` → `{ events: Opportunity[] }`: ASU Events JSON + SunDevilCentral iCal, Tempe (and online), next 7 days, 1 h in-memory cache per source; tags include the setup interests they match (`lib/feeds/`)
- [x] Kerem: `GET /api/weather` → `Weather { tempF, highF, isHot }` from Open-Meteo for Tempe (tempF = feels-like now, or at noon for `?date=` up to 7 days ahead)
- [x] Kerem: `POST /api/calendar { plan: DayPlan }` → `.ics` download of the planned day, with a reminder at every leave time
- [x] Kerem: `data/buildings.json`: 52 Tempe buildings `{ id, name, lat, lng, aliases }`, OSM centroids via Overpass (query in `data/README.md`)
- [x] Kerem: interest taxonomy (`lib/feeds/interests.ts`) that maps setup interests to ASU Events `interests` and SunDevilCentral tags
- [ ] 2 demo personas with class schedules; record one real `DayPlan` for demo mode (no grades or tokens on screen)
- [ ] Domain via the MLH GoDaddy Registry code; Devpost draft with all 3 teammates; prize checklist
- [ ] Demo video (2 minutes max, YouTube), pitch script, expo table plan, answers for "how is this different from ASU Mobile / Plz_use_it?"
- [ ] Stretch: mascot art in `web/public/`
