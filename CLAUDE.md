# DayPilot: sunhacks 2026 team repo

Working name: **DayPilot**, the AI day planner for ASU students. (We dropped the earlier name "Sunny": ASU's official chatbot is already called Sunny, heysunny.asu.edu.) Built at sunhacks 9.0 (ASU Tempe) by a team of 3. Each teammate drives their own Claude Code session in their own clone of this repo; this file is how those sessions stay in sync.

## Users and problem
ASU Tempe students with busy schedules who walk between classes and miss club events. Their information is split across Canvas (assignments), MyASU (classes), Sun Devil Central (clubs), ASU Events and the weather. None of them says when to leave, when to do the homework, or which event to go to, and the Tempe heat makes walking hard.

## The product in one sentence
DayPilot plans an ASU student's day: it pulls today's Canvas deadlines, your classes, the Tempe heat and the club events that match your interests into one timeline, tells you when to leave for each class, and talks back when you ask "how's my day?".

Positioning for judges: "ASU Mobile shows you information. DayPilot plans your day." Last year's SunHacks winners Edwin (Canvas AI TA) and Plz_use_it (Canvas + Calendar study scheduler) already did "Canvas + AI", so the demo leads with leave-times, heat and real club picks, not with the Canvas list.

## MVP flows, in build order
1. **Setup**: the student pastes their own Canvas access token (Canvas → Account → Settings → New Access Token; ASU allows it), enters class times once (day, time, building), and picks interests. No ASU password, ever.
2. **Today screen**: one timeline of classes, Canvas deadlines (with submitted/not submitted), study blocks placed in free gaps, and "leave at 13:12" for every class, plus a heat warning on hot days.
3. **Events that fit you**: real ASU Events + SunDevilCentral events in the next 7 days, ranked by Gemini against the student's interests, each with a one-line "why this fits you" (borrowed from the Sunny plan).
4. **Voice**: "How's my day?" reads a spoken briefing; "Add the robotics meeting" adds an event to the timeline (Web Speech API + Gemini turns the command into an action).
5. **Calendar export**: an ICS feed of the planned day that Google or Apple Calendar can subscribe to (borrowed from the Sunny plan).

Stretch, only after the full demo runs end to end: indoor shortcuts through air-conditioned buildings (3-5 hand-entered), "open in Cool Routes" link, MongoDB Atlas for profiles and cache, the mascot's daily "forecast" voice, Sunny-style "two futures" screen.

Cut: Canvas OAuth (needs an ASU-issued developer key), any ASU SSO login or password collection, MyASU scraping (no API), real shade routing (Cool Routes has no API), registering for club events from the app (no API), native mobile app, push notifications.

## Data sources (verified on Nov 14)
- **Canvas REST API** with the student's own token, called server-side only (CORS): `GET /api/v1/planner/items?start_date=&end_date=`, `GET /api/v1/users/self/todo`, `GET /api/v1/courses?enrollment_state=active` on `https://canvas.asu.edu`. Never store or log the token.
- **ASU Events JSON** (public, no key): `https://asuevents.asu.edu/feed-json/students`. Fields include `title`, `start_date`, `end_date`, `locations`, `campus`, `event_price_level`, `interests` (pipe-separated).
- **SunDevilCentral iCal** (public, no key): `https://sundevilcentral.eoss.asu.edu/ical/arizonau/ical_arizonau.ics` (redirects to a static file, about 5,500 events). `CATEGORIES` carry club acronym, event type and tags. Locations are hidden in the public feed; a student's personal feed link shows them.
- **Open-Meteo** (no key) for Tempe weather: latitude 33.42, longitude -111.93.
- **Building coordinates**: `data/buildings.json`, made once from OpenStreetMap via Overpass.
Do not scrape SunDevilCentral pages, MyASU or the class catalog.

## Hackathon rules that bind us
- Deadline **Sun 2026-11-15 11:00 MST** on Devpost; team target **10:30**. Expo + judging Sun 12:00-14:00 in person: the demo must work live on a laptop, and we keep a backup video.
- Everything is built during the hackathon (hacking began Sat 11:10 MST). Never paste in code from any pre-existing project.
- The GitHub repo is required evidence of work. Credit AI and tutorials: keep the "AI & attribution" section of README.md current whenever you add a library, API, dataset or tutorial.
- Judging criteria, equal weight: Originality, Complexity, Functionality, Design. A smaller feature set that works and looks great beats a bigger one that breaks.
- Arizona time is MST all year (UTC-07:00, no daylight saving). Store times as ISO 8601 with `-07:00`.

## Prize targets (each needs real, visible use we can point to in the demo)
- Best Overall
- MLH Best Use of Gemini API (event ranking, briefing, voice commands)
- MLH Best Use of MongoDB Atlas (if we store profiles and the event cache there)
- Best Use of AWS (if we deploy there), otherwise MLH Best Use of Vultr
- Best Mascot (if time allows)
- MLH Best Domain Name from GoDaddy Registry
- Best Diversity/Equality (voice-first and low-vision-friendly design, heat-sensitive students, international students new to campus)
- Audience Vote

## Stack
- `web/`: Next.js 16 (App Router, TypeScript, Tailwind 4). UI and API routes both live here. **Next 16 has breaking changes: read `web/AGENTS.md` and the matching guide in `web/node_modules/next/dist/docs/` before writing Next.js code.**
- Database (optional, stretch): MongoDB Atlas (free tier) with the official `mongodb` driver. The MVP keeps the student profile in the browser and caches feeds in server memory.
- AI: Gemini API through the official `@google/genai` SDK, called server-side only. Code does the math (free gaps, leave times, heat warning); Gemini only ranks events, estimates homework time, writes the briefing and turns a voice command into an action. Cache Gemini answers; the free tier is small.
- Voice: the browser's Web Speech API (best in Chrome).
- Calendar: we generate an `.ics` feed of the planned day that Google or Apple Calendar can subscribe to.
- API routes (all under `web/src/app/api/`):
  - **`POST /api/day`: the one call the screens make.** `{ setup: StudentSetup, canvasToken?, demo?, acceptedEventIds?, previewHot? }` → `{ setup, plan: DayPlan, dueSoon: DayItem[], picks: EventPick[] }`, all in the public types.
  - `POST /api/command`: `{ transcript, items, picks, briefing?, now? }` → `CommandResult`.
  - `POST /api/schedule` (built by B for setup): a schedule photo or pasted MyASU text → `{ classes: ClassBlock[] }` via Gemini.
  - Engine-level routes (internal types, used by tests and tools): `POST /api/canvas`, `POST /api/plan`, `GET /api/demo`.
  - C's routes: `GET /api/events`, `GET /api/weather`, `GET /api/calendar` (ICS). Until they exist, `/api/day` uses demo events and weather only in demo mode.
- Secrets live in `web/.env.local` (gitignored). `web/.env.example` lists every variable. Never commit keys; share them privately.

## Shared contract
- `web/src/lib/types.ts` is the **public contract** between screens and API routes (DayItem with `kind`, DayPlan, EventPick, CampusEvent, HeatAlert, CommandResult, StudentSetup, ClassBlock, Building). B designed it for the UI; change it only after telling the team.
- `web/src/lib/engine-types.ts` holds the planning engine's **internal** types (A only). Screens never import it.
- `web/src/lib/ui-adapter.ts` converts engine output into the public types. When the UI needs a new field, add it to `types.ts` and fill it in the adapter.

## Notion coordination
Board: Notion page "Agent Coordination" (under "SunHacks 9.0 — Team Hub"), read and written through the Notion MCP. Agent names map to repo roles: Agent-1 = A (Barış), Agent-2 = B (Arda), Agent-3 = C (Kerem).
- Before starting a task, read the "Agent Task Board" and the "Decision Log" there.
- When you take a task, set its Status to "In progress" and list the files you will touch.
- Do not touch files listed on another agent's "In progress" row.
- When an API, data shape or environment variable changes, add one line to the Decision Log.
- When a task is done, set Status to "Done" and add the branch or commit name and a one-sentence summary. Also tick it in TASKS.md.
- If blocked, set Status to "Blocked" and write why and who you are waiting for.
- If the user says "team status", summarize the board.

## Team workflow (3 people, 3 Claude sessions)
- Integration branch: **`dev`** (the default branch). Work on your own branch named `<name>/<feature>`, open small PRs into `dev`; Barış (A) or Arda (repo owner) merges once CI is green. Pull often: `git pull --rebase origin dev`, and rebase before opening a PR so it does not conflict.
- Folder ownership. Do not edit someone else's folders without asking:
  - **A = Agent-1, Barış (backend 1 + integration):** `web/src/app/api/{canvas,plan,command,day,demo}/**`, `web/src/lib/**` except `types.ts` (shared) and `lib/feeds/` (C), `scripts/**`, `web/package.json` and the lockfile.
  - **B = Agent-2, Arda (UI; repo owner):** `web/src/app/**` pages and layouts outside `api/`, `web/src/app/api/schedule/**`, `web/src/components/**`, `web/src/mocks/**`, `web/public/**`.
  - **C = Agent-3, Kerem (backend 2 + data):** `web/src/app/api/{events,weather,calendar}/**`, `web/src/lib/feeds/**`, `data/**`.
  - Shared, by agreement: README.md (demo section), `docs/**`.
- Need a new dependency? Only A edits `package.json`: ask, or note it in your PR description.
- Before every push: `cd web && npm run lint && npm run typecheck && npm test && npm run build` must pass. GitHub Actions (`.github/workflows/ci.yml`) runs the same four steps on every PR into `dev`; merge only when CI is green.
- Tests: Vitest, next to the code as `*.test.ts`. Add tests with every API route or `lib/` change. Tests never call Gemini or Canvas for real (mock `@/lib/gemini` and `fetch`).
- Commit small and often with clear messages. Never force-push. Update TASKS.md when you start or finish a task.

## Definition of done
Works end to end in the browser with real data, looks right on a laptop and a phone, and has a 20-second demo path.

## Skills in this repo (`.claude/skills/`)
- `frontend-design`: use it for every UI task (Design is a quarter of the score).
- `webapp-testing`: Playwright smoke checks before the demo.

## Timeline (MST)
- Sat 18:00: Today screen on real Canvas data with leave times (demo mode works offline).
- Sat 23:00: events that fit you + spoken briefing + voice command; first full demo run.
- Sun 06:00: feature freeze; only fixes and polish after this.
- Sun 07:00-10:00: Devpost write-up, video of 2 minutes or less, pitch rehearsal.
- Sun 10:30: submit on Devpost with all three of us listed on the project.
