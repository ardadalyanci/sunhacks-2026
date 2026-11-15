# Tasks

Update this file when you start or finish something. `[ ]` todo, `[~]` in progress (put your name), `[x]` done.
The product changed from "Sunny" to **DayPilot** on Sat afternoon; see CLAUDE.md. The repo scaffold (Next.js 16, shared types, skills) from the first commit stays.

## A: backend 1 + integration (Agent-1, Barış)
- [x] Barış: DayPilot pivot: CLAUDE.md, TASKS.md, README, `DayItem` types
- [x] `web/src/lib/gemini.ts` (Gemini client, server-only, 1 h answer cache, null on failure) — each teammate still needs `GEMINI_API_KEY` in `web/.env.local`
- [x] `POST /api/canvas`: token in body → Canvas planner items → deadline `DayItem[]` with submitted status (never stored or logged)
- [x] `POST /api/plan`: classes + deadlines + events → free gaps, study blocks, leave times, heat (code), event ranking + briefing (Gemini, with code fallbacks) → `DayPlan`
- [x] `POST /api/command`: voice text → `CommandAction` (Gemini, with keyword-rule fallback)
- [x] Barış: test `/api/plan` and `/api/command` with a real Gemini key (PR #11: default model was missing on the v1 API, now `gemini-3.5-flash-lite`; time-aware briefing)
- [x] Barış: voice answers "what's next / when do I leave?" from the plan (PR #12, `{ action: "briefing", reply }`; UI speaks `reply` once B adds one line)
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
- [x] PWA: `app/manifest.ts` (installs to the home screen, opens on /today), static Sol icons `app/icon.png` + `app/apple-icon.png` (generated icon routes caused a dev reload loop)
- [x] Arda: review findings 1-7 from Agent-1 (branch `arda/review-fixes`): newest re-plan wins, removed study blocks saved per day, timeline stretches to early classes and 11:59 pm deadlines with stacked pins, "Added" only when it really was, setup marks bad rows and has Sat/Sun, `/api/schedule` 413 on size + 5 reads/min per address, one shared day load across Today and Events; also shrinks large phone photos before upload (Vercel's 4.5 MB body limit)
- [ ] Phone pass on the live Vercel URL

## C: backend 2 + data (Agent-3, Kerem)
- [ ] `GET /api/events`: ASU Events JSON + SunDevilCentral iCal → `Opportunity[]`, next 7 days, Tempe, 1 h in-memory cache
- [ ] `GET /api/weather`: Open-Meteo for Tempe → `Weather`
- [ ] `GET /api/calendar`: ICS of the planned day
- [ ] `data/buildings.json`: ~20 Tempe buildings (id, name, lat, lng) from Overpass, checked on the map
- [ ] Interest taxonomy that maps to ASU Events `interests` and SunDevilCentral tags
- [ ] 2 demo personas with class schedules; record one real `DayPlan` for demo mode (no grades or tokens on screen)
- [ ] Domain via the MLH GoDaddy Registry code; Devpost draft with all 3 teammates; prize checklist
- [ ] Demo video (2 minutes max, YouTube), pitch script, expo table plan, answers for "how is this different from ASU Mobile / Plz_use_it?"
- [ ] Stretch: mascot art in `web/public/`
