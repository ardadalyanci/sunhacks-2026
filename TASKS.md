# Tasks

Update this file when you start or finish something. `[ ]` todo, `[~]` in progress (put your name), `[x]` done.
The product changed from "Sunny" to **DayPilot** on Sat afternoon; see CLAUDE.md. The repo scaffold (Next.js 16, shared types, skills) from the first commit stays.

## A: backend 1 + integration (Agent-1, Barış)
- [x] Barış: backend speaks the UI contract (`types.ts` from B; engine types in `engine-types.ts`, `lib/ui-adapter.ts`, `POST /api/day`, `/api/command` → `CommandResult`, `lib/api-client.ts` for the screens)
- [ ] Call Kerem's `getEvents()` / `getWeather()` from `/api/day` once `lib/feeds` lands (today a real day has no events or weather)
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

## B: UI (Agent-2, Arda; repo owner)
Screens read the day from `POST /api/day` through `components/useDay.ts` (`fetchDay()`); `web/src/mocks/` is gone.
- [x] Design system: "Arizona sky" (time of day is color), Bricolage Grotesque + Atkinson Hyperlegible Next
- [x] Rebrand to DayPilot (name lives in `web/src/components/brand.ts`; "DayPilot" is also a JS calendar library, team may rename)
- [x] Mascot Sol: sun with pilot goggles and scarf; moods happy / listening / hot / proud; float + blink
- [x] Home page: big Sol with speech bubble, "from your first walk to your last event" timeline, setup CTA
- [x] Today screen: sky timeline of classes, study blocks, leave-at markers, due pins, events; heat alert + 106°F preview toggle
- [x] Events screen: picks by interest with "why", RSVP link
- [x] Voice: Hear my day (speechSynthesis), Ask (Web Speech) + typed fallback → `/api/command`, local fallback until it exists
- [x] Setup: Canvas token how-to; classes from a photo, pasted text or by hand (`POST /api/schedule`); interests
- [x] Arda: wire Today, Events, layout and setup to `POST /api/day` with `fetchDay()` from `lib/api-client.ts` (replaces `mocks/day.ts`); send `briefing` and `now` in `components/commands.ts` so voice reads the real briefing (branch `arda/wire-day`; added events persist in the tab, study blocks can be removed, `/api/schedule` tests)
- [x] PWA: `app/manifest.ts` (installs to the home screen, opens on /today), `app/icon.tsx` + `app/apple-icon.tsx` drawn from Sol; default favicon and starter images removed (branch `arda/pwa`)
- [ ] Phone pass at 375px on the live Vercel URL

## C: backend 2 + data (Agent-3, Kerem)
- [ ] `GET /api/events` + `lib/feeds/events.ts` exporting `getEvents(): Promise<CampusEvent[]>` (public type): ASU Events JSON + SunDevilCentral iCal, next 7 days, Tempe, 1 h in-memory cache. `/api/day` calls `getEvents()` directly
- [ ] `GET /api/weather` + `lib/feeds/weather.ts` exporting `getWeather(): Promise<Weather>` (public type: hourly feels-like + high) from Open-Meteo for Tempe
- [ ] `GET /api/calendar`: ICS of the planned day
- [ ] `data/buildings.json`: ~20 Tempe buildings as public `Building` (`code`, `name`, `lat`, `lng`) from Overpass, checked on the map. Leave times use it
- [ ] Interest taxonomy that maps to ASU Events `interests` and SunDevilCentral tags
- [ ] 2 demo personas with class schedules; record one real `DayPlan` for demo mode (no grades or tokens on screen)
- [ ] Domain via the MLH GoDaddy Registry code; Devpost draft with all 3 teammates; prize checklist
- [ ] Demo video (2 minutes max, YouTube), pitch script, expo table plan, answers for "how is this different from ASU Mobile / Plz_use_it?"
- [ ] Stretch: mascot art in `web/public/`
