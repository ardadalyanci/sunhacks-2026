# Tasks

Update this file when you start or finish something. `[ ]` todo, `[~]` in progress (put your name), `[x]` done.
The product changed from "Sunny" to **DayPilot** on Sat afternoon and to **Sundial** (sundial.club) on Sat evening; see CLAUDE.md. The repo scaffold (Next.js 16, shared types, skills) from the first commit stays.

## A: backend 1 + integration (Agent-1, Barış)
- [x] Barış: DayPilot pivot: CLAUDE.md, TASKS.md, README, `DayItem` types
- [x] `web/src/lib/gemini.ts` (Gemini client, server-only, 1 h answer cache, null on failure) — each teammate still needs `GEMINI_API_KEY` in `web/.env.local`
- [x] `POST /api/canvas`: token in body → Canvas planner items → deadline `DayItem[]` with submitted status (never stored or logged)
- [x] `POST /api/plan`: classes + deadlines + events → free gaps, study blocks, leave times, heat (code), event ranking + briefing (Gemini, with code fallbacks) → `DayPlan`
- [x] `POST /api/command`: voice text → `CommandAction` (Gemini, with keyword-rule fallback)
- [x] Barış: test `/api/plan` and `/api/command` with a real Gemini key (PR #11: default model was missing on the v1 API, now `gemini-3.5-flash-lite`; time-aware briefing)
- [x] Barış: voice answers "what's next / when do I leave?" from the plan (PR #12, `{ action: "briefing", reply }`; UI speaks `reply` once B adds one line)
- [x] Barış: `lib/buildings.ts` imports `data/buildings.json`, so Vercel bundles it (PR #19)
- [x] Demo mode: `GET /api/demo` (sample student + full day for any date, `hot=1` for a heat day) and Canvas token `demo`; works with no Wi-Fi, token or Gemini
- [ ] Deploy (Vercel or AWS Amplify) + custom domain
- [x] Barış: MongoDB Atlas: saved day plans + calendar subscribe URL (`GET /api/plan/<calendarId>/calendar`), Gemini answers cached in Atlas (branch `baris/mongo-atlas`). Profiles and the event cache were left out (no login; event cache is C's file)

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
- [x] Arda: day picker on Today (Today, Tomorrow, next 5 days; branch `arda/future-days`): the chosen day lives in the URL hash, `useDay(date)` sends it to `/api/demo?date=`, `/api/canvas`, `/api/weather?date=` and `/api/plan` (look-ahead briefing from PR #15); later days show "Preview of …" and hide the 104°F toggle; removed blocks are saved per day
- [x] Arda: phone pass on the live Vercel URL (https://sunhacks-2026.vercel.app, 375 px and 1440 px: sample day and a real setup with live weather, events and leave times, no console errors)
- [x] Arda: after the live check (branch `arda/live-polish`): "Add to my calendar" on Today downloads the day from `POST /api/calendar`; Events opens on "For you" (interests + Gemini picks) instead of all ~485 events; a leave pin that would cover another block moves right with shorter text
- [x] Arda: renamed the product to **Sundial** (domain sundial.club; Decision Log Sat 18:40): `components/brand.ts`, manifest, calendar file name; storage keys keep the `daypilot.` prefix so saved setups still load
- [x] Arda: "Subscribe in your calendar" (PR #21 follow-up): the browser keeps one `calendarId` (`crypto.randomUUID()`), sends it with every `/api/plan`, and the calendar panel offers Google Calendar, Apple Calendar (webcal) and Copy link for `plan.calendarUrl`; without MongoDB it falls back to the one-day download

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
