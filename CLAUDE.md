# Sunny: sunhacks 2026 team repo

Working name: **Sunny**, the AI copilot for ASU students. Built at sunhacks 9.0 (ASU Tempe) by a team of 3. Each teammate drives their own Claude Code session in their own clone of this repo; this file is how those sessions stay in sync.

## The product in one sentence
Sunny knows your goals, classes and interests, finds the club events, career fairs, hackathons and internships worth your time, fits them into your week, puts them on your calendar, and shows you **two futures**: you next May if nothing changes, and you with the plan.

## MVP flows, in build order
1. **Onboarding**: resume PDF, career goals, social interests, class schedule (Canvas calendar ICS link, or a screenshot that Gemini reads).
2. **Opportunity feed**: real, current opportunities (ASU club events from SunDevilCentral, career fairs and employer sessions, MLH hackathons, internships from public Greenhouse/Lever job boards). Stored in MongoDB Atlas, ranked per student with Gemini embeddings + Atlas Vector Search, each with a one-line "why this fits you" written by Gemini.
3. **Weekly plan**: top picks placed into free slots around classes, plus one ICS subscription link that works in both Google Calendar and Apple Calendar.
4. **Two futures** (the demo's wow moment): side by side, the projected profile in May 2027 as-is vs. with Sunny's plan (skills, resume lines, people met), grounded in the student's real resume and the chosen opportunities.
5. **Agent actions**: draft a short intro message to a club officer or recruiter; a one-screen career-fair brief per company.
6. **Sunny the mascot**: a weekly "forecast" briefing and one consistent personality across the UI.

Cut unless everything above is done: friend matching / social graph, native mobile app, real auth (use a demo-profile switcher), Google Calendar OAuth (the ICS link covers both calendars).

## Hackathon rules that bind us
- Deadline **Sun 2026-11-15 11:00 MST** on Devpost; team target **10:30**. Expo + judging Sun 12:00-14:00 in person: the demo must work live on a laptop, and we keep a backup video.
- Everything is built during the hackathon (hacking began Sat 11:10 MST). Never paste in code from any pre-existing project.
- The GitHub repo is required evidence of work. Credit AI and tutorials: keep the "AI & attribution" section of README.md current whenever you add a library, API, dataset or tutorial.
- Judging criteria, equal weight: Originality, Complexity, Functionality, Design. A smaller feature set that works and looks great beats a bigger one that breaks.
- Arizona time is MST all year (UTC-07:00, no daylight saving). Store times as ISO 8601 with `-07:00`.

## Prize targets (each needs real, visible use we can point to in the demo)
- Best Overall
- JFFVentures Best Hack for the Future of Work
- MLH Best Use of Gemini API
- MLH Best Use of MongoDB Atlas
- Best Use of TinyFish
- Best Use of AWS (if we deploy there), otherwise MLH Best Use of Vultr
- Best Mascot (Sunny)
- MLH Best Domain Name from GoDaddy Registry
- Best Diversity/Equality (first-gen and international students who miss opportunities)
- Audience Vote

## Stack
- `web/`: Next.js 16 (App Router, TypeScript, Tailwind 4). UI and API routes both live here. **Next 16 has breaking changes: read `web/AGENTS.md` and the matching guide in `web/node_modules/next/dist/docs/` before writing Next.js code.**
- Database: MongoDB Atlas (free tier) with the official `mongodb` driver; Atlas Vector Search for matching.
- AI: Gemini API through the official `@google/genai` SDK, called server-side only.
- Opportunity collection: TinyFish web agents (access comes from the TinyFish workshop, Sat 16:30) and public JSON job boards; until then, the hand-made seed file in `data/`.
- Calendar: we generate an `.ics` feed at `/api/calendar/[studentId]` that Google or Apple Calendar subscribes to.
- Secrets live in `web/.env.local` (gitignored). `web/.env.example` lists every variable. Never commit keys; share them privately.

## Shared contract
`web/src/lib/types.ts` is the single source of truth for data shapes (Student, Opportunity, Recommendation, PlanItem, Futures). Build against it. Only teammate A changes it, after asking in the team chat.

## Team workflow (3 people, 3 Claude sessions)
- Integration branch: **`dev`** (the default branch). Work on your own branch named `<name>/<feature>`, open small PRs into `dev`, and the repo owner (B) merges. Pull often: `git pull --rebase origin dev`.
- Folder ownership. Do not edit someone else's folders without asking:
  - **A (data + backend):** `web/src/app/api/**`, `web/src/lib/**`, `scripts/**`, `web/package.json` and the lockfile.
  - **B (UI; the repo owner, who also merges PRs):** `web/src/app/**` pages and layouts outside `api/`, `web/src/components/**`, `web/src/mocks/**` (mock data the screens use until A's APIs are live).
  - **C (content, mascot, demo):** `web/public/**`, `data/**`, `docs/**`, the demo section of README.md.
- Need a new dependency? Only A edits `package.json`: ask, or note it in your PR description.
- Before every push: `cd web && npm run lint && npm run build` must pass.
- Commit small and often with clear messages. Never force-push. Update TASKS.md when you start or finish a task.

## Definition of done
Works end to end in the browser with real data, looks right on a laptop and a phone, and has a 20-second demo path.

## Skills in this repo (`.claude/skills/`)
- `frontend-design`: use it for every UI task (Design is a quarter of the score).
- `webapp-testing`: Playwright smoke checks before the demo.

## Timeline (MST)
- Sat 18:00: onboarding + feed working with real data.
- Sat 21:00: weekly plan + ICS + two futures; first full demo run.
- Sun 06:00: feature freeze; only fixes and polish after this.
- Sun 07:00-10:00: Devpost write-up, video of 2 minutes or less, pitch rehearsal.
- Sun 10:30: submit on Devpost with all three of us listed on the project.
