# DayPilot: the AI day planner for ASU students

ASU Mobile shows you information. DayPilot plans your day. It pulls today's Canvas deadlines, your classes, the Tempe heat and the club events that match your interests into one timeline, tells you when to leave for each class, and talks back when you ask "how's my day?".

DayPilot never asks for your ASU password. It uses official sources only: the Canvas API with a token you create yourself, the public ASU Events feed, the public SunDevilCentral calendar feed and Open-Meteo.

Built at sunhacks 9.0 (November 14-15, 2026, ASU Tempe). Work in progress during the hackathon.

## Run it locally
```bash
cd web
cp .env.example .env.local   # then fill in your own keys
npm install
npm run dev                  # http://localhost:3000
npm test                     # unit + API route tests (Vitest)
```

Demo mode needs no keys or network: `GET /api/demo` returns a sample student's day (add `?hot=1` for a heat-warning day); send its `request` to `POST /api/plan`. In the setup screen, the Canvas token `demo` loads sample deadlines.

## Team
<!-- names and GitHub handles -->

## AI & attribution
- The team used Claude Code (Anthropic) as an AI coding assistant; generated code was reviewed by the team.
- Claude skills vendored in `.claude/skills/`: `frontend-design` and `webapp-testing` from [anthropics/skills](https://github.com/anthropics/skills), Apache-2.0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- App scaffolded with `create-next-app` (Next.js 16).
- Google's [`@google/genai`](https://www.npmjs.com/package/@google/genai) SDK (Apache-2.0) for the Gemini API.
- [Vitest](https://vitest.dev/) (MIT) for tests.
- Data sources and APIs are listed here as we add them, with links and licenses:
  - [Canvas LMS REST API](https://canvas.asu.edu/doc/api/), with each student's own access token
  - [ASU Events feed](https://asuevents.asu.edu/) (`/feed-json/students`)
  - [SunDevilCentral public calendar feed](https://sundevilcentral.eoss.asu.edu/ical/arizonau/ical_arizonau.ics)
  - [Open-Meteo](https://open-meteo.com/) weather API (CC BY 4.0)
  - [OpenStreetMap](https://www.openstreetmap.org/copyright) building data via Overpass (ODbL)
