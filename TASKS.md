# Tasks

Update this file when you start or finish something. `[ ]` todo, `[~]` in progress (put your name), `[x]` done.

## A: backend + data
- [ ] `web/src/lib/gemini.ts` (Gemini client, responses cached)
- [ ] `POST /api/canvas`: token → `/api/v1/planner/items` + `/api/v1/users/self/todo` → `DayItem[]` (token never stored or logged)
- [ ] `GET /api/events`: ASU Events JSON + Sun Devil Central iCal → `CampusEvent[]` (1-hour cache, next 7 days, Tempe)
- [ ] `GET /api/weather`: Open-Meteo hourly for Tempe → `Weather`
- [ ] `POST /api/plan`: free gaps → study blocks, leave-at times (walk minutes between buildings), heat alert, Gemini briefing → `DayPlan`
- [ ] `POST /api/command`: Gemini turns a transcript into `CommandResult`
- [ ] `buildings.json`: ~20 Tempe buildings with coordinates (OpenStreetMap / Overpass)
- [ ] Deploy on Vercel (root directory `web`, production branch `dev`) + custom domain

## B: UI (repo owner)
Screens run on mock data from `web/src/mocks/` until A's routes are live.
- [x] Design system: "Arizona sky" (time of day is color), Bricolage Grotesque + Atkinson Hyperlegible Next
- [ ] Rebrand to DayPilot
- [ ] Today screen: sky timeline of classes, assignments, study blocks, events, leave-at and heat alerts
- [ ] Events screen: picks by interest with "why", add to today, RSVP link
- [ ] Voice: mic button (Web Speech API) → `/api/command`; spoken briefing (speechSynthesis)
- [ ] Setup: Canvas token (with how-to), classes entered by hand, interests
- [ ] Wire each screen to A's routes
- [ ] PWA manifest + icons; phone pass at 375px

## C: content, mascot, demo
- [ ] Mascot art in `web/public/mascot/`
- [ ] Demo persona: a real-looking class schedule + interests (and a Canvas test account or token if possible)
- [ ] Domain via the MLH GoDaddy Registry code; Devpost project draft with all 3 teammates added; prize checklist
- [ ] Demo video (2 minutes max, YouTube), pitch script, expo table plan
- [ ] Talk to sponsors: Gemini/MLH, JFF (Future of Work), MongoDB
