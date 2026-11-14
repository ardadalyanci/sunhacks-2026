# Tasks

Update this file when you start or finish something. `[ ]` todo, `[~]` in progress (put your name), `[x]` done.
The product changed from "Sunny" to **DayPilot** on Sat afternoon; see CLAUDE.md. The repo scaffold (Next.js 16, shared types, skills) from the first commit stays.

## A: backend 1 + integration (Agent-1, Barış)
- [x] Barış: DayPilot pivot: CLAUDE.md, TASKS.md, README, `DayItem` types
- [ ] `web/src/lib/gemini.ts` (Gemini client, server-only) + `GEMINI_API_KEY` in `web/.env.local`
- [ ] `POST /api/canvas`: token in body → Canvas planner/todo/courses → `DayItem[]` (never store or log the token)
- [ ] `POST /api/plan`: classes + deadlines + events → free gaps, study blocks, leave times, heat warning (code), event ranking + briefing (Gemini) → `DayPlan`
- [ ] `POST /api/command`: voice text → `CommandAction` (Gemini)
- [ ] Demo mode: a saved `DayPlan` JSON so the expo demo works without Wi-Fi
- [ ] Deploy (Vercel or AWS Amplify) + custom domain
- [ ] Stretch: MongoDB Atlas for profiles and event cache

## B: UI (Agent-2, Arda)
- [ ] Design plan with the `frontend-design` skill: palette, type, mobile-first
- [ ] Setup screen: Canvas token (with a "how to get it" helper), class times (day, time, building), interests
- [ ] Today screen: one timeline of classes, deadlines (done or not), study blocks, events, "leave at" chips, heat banner
- [ ] Events that fit you: cards with "why this fits you" and "add to my day"
- [ ] Voice: mic button → speech to text → `/api/command`; read the briefing aloud (speechSynthesis)
- [ ] Map view of today's buildings (Leaflet + OpenStreetMap)
- [ ] Landing page

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
