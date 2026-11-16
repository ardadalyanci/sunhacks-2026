# Sundial: the AI day planner for ASU students

ASU Mobile shows your schedule. Sundial plans your day. It pulls today's Canvas deadlines, your classes, the Tempe heat and the club events that match your interests into one timeline, tells you when to leave for each class, and talks back when you ask "when should I leave?".

Sundial never asks for your ASU password. It uses official sources only: the Canvas API with a token you create yourself, the public ASU Events feed, the public SunDevilCentral calendar feed and Open-Meteo.

Built at sunhacks 9.0 (November 14-15, 2026, ASU Tempe). Live at https://sunhacks-2026.vercel.app.

## What it does
- **Tells you when to leave.** The Today screen opens with the next walk ("Leave at 10:18 am, Diego.") computed from the distance between 52 ASU buildings, with a countdown and walking directions.
- **Plans around the heat.** Live Tempe weather; on hot days every walk starts earlier, and "What if it's 104°?" shows it any day. Students who need more time to walk can say so in setup.
- **Fits your homework in.** Canvas deadlines (turned in or not) become study blocks in the free gaps before each one is due, never longer than Gemini's estimate of the work.
- **Finds the club nights worth the walk.** About 475 live events a week from ASU Events and Sun Devil Central; Gemini ranks the ones that fit your free time against your interests and says why, and "+ Add" puts Sol's pick on your day.
- **"What if…"** One tap previews a 104° day, oversleeping, or a cancelled class, alone or together; Sol re-plans and says in one line what moved. A what-if day is never saved to your calendar.
- **Shows the day as the Arizona sky.** The timeline's colors follow Tempe's real sunrise and sunset; "Play my day" runs Sol, the sun mascot, through it. The same day is also a plain large list for zoom and screen readers.
- **Talks.** "Hear my day" reads a three-sentence briefing; "Ask Sol" takes "when should I leave?" or "add the robotics meeting" by voice or text. With no Wi-Fi it still answers "what's next?" from the plan on screen, and errors read as plain sentences.
- **Shows its work.** "How Sol planned this day" lists, with the day's real numbers, what Gemini did and what plain code did.
- **Reaches your calendar.** Subscribe once in Google or Apple Calendar and every planned day arrives with a reminder at each leave time.

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
- Barış ([bariskiratt](https://github.com/bariskiratt)): planning engine, Canvas, Gemini, MongoDB Atlas, integration
- Arda ([ardadalyanci](https://github.com/ardadalyanci)): screens, design, voice, mascot
- Kerem ([Kerem-Oncer](https://github.com/Kerem-Oncer)): event and weather feeds, calendar files, building data

## AI & attribution
- The team used Claude Code (Anthropic) as an AI coding assistant throughout: each teammate drove their own session, coordinated through a shared task board. In later rounds Claude agents also acted as reviewers (a mock judge panel, ASU student personas, a copy critic, a demo coach) and as parallel implementers working from written specs. The team chose what to build and merged every change.
- Claude skills vendored in `.claude/skills/`: `frontend-design` and `webapp-testing` from [anthropics/skills](https://github.com/anthropics/skills), Apache-2.0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- App scaffolded with `create-next-app` (Next.js 16).
- Google's [`@google/genai`](https://www.npmjs.com/package/@google/genai) SDK (Apache-2.0) for the Gemini API.
- [Vitest](https://vitest.dev/) (MIT) for tests.
- [MongoDB Node.js driver](https://www.npmjs.com/package/mongodb) (Apache-2.0) and [MongoDB Atlas](https://www.mongodb.com/atlas) (free M0 cluster): saved day plans behind the calendar subscribe URL, and a shared cache of Gemini answers. Optional: without `MONGODB_URI` the app runs the same, minus the subscribe URL.
- The iCalendar reader and writer in `web/src/lib/feeds/ical.ts` were written for this project from [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545); no calendar library is used.
- Sunrise and sunset for the sky timeline come from NOAA's published [solar calculation equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF), implemented by hand in `web/src/components/sky-layout.ts` and tested against the almanac for Tempe.
- Voice uses the browser's built-in [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) (speech recognition and speech synthesis); no speech service or key.
- "Walk me there" opens a [Google Maps directions link](https://developers.google.com/maps/documentation/urls/get-started) (a plain URL, no API key).
- Fonts: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) and [Atkinson Hyperlegible Next](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next) (SIL Open Font License), loaded with `next/font`.
- The mascot Sol and all artwork were drawn for this project as SVG in code (`web/src/components/Mascot.tsx`).
- Data sources and APIs are listed here as we add them, with links and licenses:
  - [Canvas LMS REST API](https://canvas.asu.edu/doc/api/), with each student's own access token
  - [ASU Events feed](https://asuevents.asu.edu/) (`/feed-json/students`)
  - [SunDevilCentral public calendar feed](https://sundevilcentral.eoss.asu.edu/ical/arizonau/ical_arizonau.ics)
  - [Open-Meteo](https://open-meteo.com/) weather API (CC BY 4.0)
  - ASU Parking and Transit Services intercampus shuttle pages ([cfo.asu.edu/shuttles](https://cfo.asu.edu/shuttles)): published frequencies, stop service windows and ride times, hand-entered in `web/src/lib/shuttles.json` for `GET /api/shuttles` (no departure times; live times stay on ASU's tracker)
  - [OpenStreetMap](https://www.openstreetmap.org/copyright) building data via Overpass (ODbL), and OpenStreetMap map tiles under the "Your walks" map (© OpenStreetMap contributors); the map itself is plain SVG, no map library
