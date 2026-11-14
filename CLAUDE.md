# DayPilot: sunhacks 2026 team repo

**DayPilot** plans an ASU student's day around Canvas assignments, class times, the Tempe heat and the club events that match their interests, and you can talk to it. Positioning: "ASU Mobile shows information; DayPilot plans your day." Built at sunhacks 9.0 (ASU Tempe) by a team of 3. Each teammate drives their own Claude Code session in their own clone; this file keeps those sessions in sync. The team's plan lives in Notion ("Fikir Planı"); this file mirrors it.

Do not call the product "Sunny": ASU already has a chatbot with that name.

## Users and problem
ASU Tempe students with busy schedules who walk between classes and miss club events. Their information is split across Canvas (assignments), MyASU (classes), Sun Devil Central (clubs), ASU Events and the weather. None of them says when to leave, when to do the homework, or which event to go to, and the Tempe heat makes walking hard.

## MVP (all three are required for the demo)
1. **Today screen**: Canvas assignments with submission status, class times, study blocks placed into free gaps, "leave at 1:12 pm" alerts, heat alert.
2. **Event picks**: events from ASU Events + Sun Devil Central that match the student's interests, ranked by Gemini, with the RSVP link.
3. **Voice briefing and commands**: "How's my day?", "Add the robotics meeting".

If time allows: air-conditioned building shortcuts (3-5 buildings by hand), a Cool Routes link, `.ics` export, MongoDB Atlas, event locations from the student's personal Sun Devil Central link.

## Not doing (and what we do instead)
- Canvas OAuth (needs an ASU developer key) → the student pastes their own Canvas access token.
- ASU SSO or collecting ASU passwords → never.
- Class times from MyASU (no API) → the student enters them once during setup.
- Real shaded routing (Cool Routes has no API) → leave time + heat alert + a Cool Routes link.
- Registering for club events in the app (no API) → RSVP link.
- Native iOS/Android app and push notifications → PWA.

## Stack
- `web/`: Next.js 16 (App Router, TypeScript, Tailwind 4), PWA, mobile first. Leaflet + OpenStreetMap for the map. **Next 16 has breaking changes: read `web/AGENTS.md` and the matching guide in `web/node_modules/next/dist/docs/` before writing Next.js code.**
- Backend: Next.js API routes, deployed on Vercel. Canvas requests go through the server (CORS); the Canvas token is never stored and never logged.
- AI: Gemini API (free tier), only for: ranking events, estimating how long an assignment takes, writing the briefing, and turning a voice command into an action. Code does the math (gaps, leave times, heat alerts). Cache responses; everyone uses their own key.
- Voice: Web Speech API (best in Chrome).
- Data sources (all tested by the team):
  - Canvas REST API with the student's own token: `/api/v1/planner/items`, `/api/v1/users/self/todo`, `/api/v1/courses`. Canvas iCal link as a fallback.
  - ASU Events JSON: https://asuevents.asu.edu/feed-json/students (has an interests field).
  - Sun Devil Central iCal: https://sundevilcentral.eoss.asu.edu/ical/arizonau/ical_arizonau.ics (about 5,500 events, no login, locations hidden).
  - Open-Meteo for weather (no key); `buildings.json` with ~20 buildings from OpenStreetMap (Overpass).
  - Optional: MongoDB Atlas.

## API routes (contract in `web/src/lib/types.ts`)
- `POST /api/canvas`: token → planner/todo → `DayItem[]`
- `GET /api/events`: ASU Events + Sun Devil Central, cached 1 hour, next 7 days, Tempe only → `CampusEvent[]`
- `GET /api/weather`: Open-Meteo for Tempe → `Weather`
- `POST /api/plan`: gaps, leave times, heat alert + Gemini briefing → `DayPlan`
- `POST /api/command`: Gemini turns a voice command into `{ action, id }` → `CommandResult`
- `POST /api/schedule` (built by B for setup): a schedule photo or pasted MyASU text → `{ classes: ClassBlock[] }` via Gemini (REST, no extra dependency; model from `GEMINI_MODEL`, default `gemini-3.8-flash`)

## Hackathon rules that bind us
- Deadline **Sun 2026-11-15 11:00 MST** on Devpost; team target **10:30**. Expo + judging Sun 12:00-14:00 in person: the demo must work live, and we keep a backup video.
- Everything is built during the hackathon. Never paste in code from a pre-existing project.
- GitHub is required evidence of work. Credit AI and tutorials: keep the "AI & attribution" section of README.md current.
- Judging, equal weight: Originality, Complexity, Functionality, Design.
- Arizona time is MST all year (UTC-07:00, no daylight saving). Store times as ISO 8601 with `-07:00`.

## Prize targets (each needs real, visible use)
Best Overall; MLH Best Use of Gemini API; JFFVentures Best Hack for the Future of Work (student productivity); Best Diversity/Equality (voice-first and low-vision-friendly design); MLH Best Use of MongoDB Atlas (if we add it); Best Mascot; MLH GoDaddy Registry domain; Audience Vote.

## Shared contract
`web/src/lib/types.ts` is the single source of truth for data shapes. Build against it. Change it only after telling the team.

## Team workflow (3 people, 3 Claude sessions)
- Integration branch: **`dev`** (the default branch). Work on your own branch named `<name>/<feature>`, open small PRs into `dev`; the repo owner merges. Pull often: `git pull --rebase origin dev`.
- Folder ownership. Do not edit someone else's folders without asking:
  - **A (backend + data):** `web/src/app/api/**`, `web/src/lib/**` (except `types.ts`, which is shared), `scripts/**`, `web/package.json` and the lockfile.
  - **B (UI; the repo owner):** `web/src/app/**` pages and layouts outside `api/`, `web/src/components/**`, `web/src/mocks/**` (mock data the screens use until A's routes are live).
  - **C (content, mascot, demo):** `web/public/**`, `data/**`, `docs/**`, the demo section of README.md.
- Need a new dependency? Only A edits `package.json`: ask, or note it in your PR description.
- Before every push: `cd web && npm run lint && npm run build` must pass.
- Commit small and often with clear messages. Never force-push. Update TASKS.md when you start or finish a task.

## Definition of done
Works end to end in the browser with real data, looks right on a phone and a laptop, and has a 20-second demo path.

## Skills in this repo (`.claude/skills/`)
- `frontend-design`: use it for every UI task (Design is a quarter of the score).
- `webapp-testing`: Playwright smoke checks before the demo.

## Timeline (MST)
- Sat 18:00: Today screen on real Canvas + events data.
- Sat 21:00: voice briefing + commands; first full demo run.
- Sun 06:00: feature freeze; only fixes and polish after this.
- Sun 07:00-10:00: Devpost write-up, video of 2 minutes or less, pitch rehearsal.
- Sun 10:30: submit on Devpost with all three of us listed on the project.
