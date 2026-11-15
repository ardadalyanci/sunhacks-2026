# Devpost text for Sundial

Paste each section into the matching Devpost field. Live site: https://sunhacks-2026.vercel.app
(sundial.club once the domain is connected).

## Tagline

ASU Mobile shows your schedule. Sundial plans your day: when to leave for class, when to study, and which club
events are worth the walk in the Tempe heat.

## Inspiration

Every ASU student has done the math on the way out the door: how long is the walk from Manzanita to Brickyard,
is it already too hot to take the long way, did I turn in that lab, and is there anything worth staying on campus
for tonight. The answers are spread over Canvas, a class schedule, a weather app and two event sites. ASU Mobile
shows the information. We wanted something that does the planning, the way a sundial tells time by the sun: our
sun mascot, Sol, tells you when to leave.

## What it does

Sundial turns an ASU student's day into one plan.

- **When to leave.** Today opens on the next walk, like "Leave at 10:18 am, Diego.", with the walk minutes, a
  countdown and a "Walk me there" link to Google Maps. Leave times come from the distances between 52 ASU Tempe
  buildings.
- **Plans around the heat.** Live Tempe weather from Open-Meteo. On a hot day every walk starts earlier and Sol
  shows a heat warning in °F and °C. Students who need more time to walk (a slower pace, a mobility aid, heat that
  hits hard) can say so in Setup, and every walk gets 35% longer.
- **Fits homework in.** With the student's own Canvas access token, assignments due today and tomorrow show up as
  turned in or not, and study blocks land in the free time before each one is due.
- **Finds events worth the walk.** Live events from ASU Events and Sun Devil Central for the next 7 days. Gemini
  ranks the ones that fit the student's free time against their interests and says why in one line, and a dashed
  "+ Add" block puts Sol's pick on the day.
- **"What if…"** One tap previews a 104° day, oversleeping by an hour, or a cancelled class, in any mix. Sol
  re-plans and says in one line what moved.
- **Talks.** "Hear my day" reads Sol's three-sentence briefing out loud. "Ask Sol" takes "when should I leave?",
  "what's next?", "add the robotics meeting" or "drop the study block" by voice or text.
- **Shows the day as the Arizona sky.** The timeline's colors follow Tempe's real sunrise and sunset, and "Play my
  day" sends Sol across it. The same day is also a large plain list for zoom and screen readers. "Your walks" puts
  every leg on a map.
- **Shows its work.** "How Sol planned this day" lists, with the day's real numbers, what came from Canvas, the
  feeds and the weather, what Gemini did and what plain code did.
- **Reaches your calendar.** Subscribe once in Google or Apple Calendar and every planned day arrives with a
  reminder at each leave time, or download one day as an .ics file.
- **Works without setup.** With nothing saved, Sundial shows a sample student, Diego, so anyone can try it in
  one click. It installs to a phone's home screen.

Sundial never asks for an ASU password. It only uses official sources: the Canvas API with a token the student
creates, the public ASU Events feed, the public Sun Devil Central calendar feed and Open-Meteo.

## How we built it

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4) for the screens and the API routes, deployed on Vercel.
- **A planning engine in plain code.** It finds the free gaps from 8 am to 10 pm, computes each walk (straight-line
  distance between building centers times 1.3 for real paths, at 80 meters a minute, plus 2 minutes, with 2 more
  on a hot day), places study blocks before each deadline and keeps only the events that fit, walk included.
  Building coordinates come from OpenStreetMap through one Overpass query, checked and coded by hand.
- **Gemini API** through Google's `@google/genai` SDK (gemini-3.5-flash-lite by default). Gemini ranks the events
  that fit and writes a reason from facts we pass in, estimates how long each assignment takes, writes Sol's
  briefing, turns a spoken or typed sentence into an action on the plan, and reads a class schedule from a photo
  or pasted text. Every answer has to match a JSON schema and use only ids we offered, and every step has a
  plain-code fallback, so the app keeps working when Gemini is slow, rate-limited or offline.
- **MongoDB Atlas** keeps each planned day behind the student's private calendar URL and a shared cache of
  Gemini answers. TTL indexes delete saved days 3 days after they happen and cached answers after 1 hour. Without
  the database the app still runs, minus the subscribe link.
- **Feeds.** ASU Events JSON and the Sun Devil Central iCal feed, filtered to Tempe and the next 7 days and cached
  for an hour; Open-Meteo for Tempe weather. We wrote our own iCalendar reader and writer from RFC 5545, both for
  the Sun Devil Central feed and for the calendar we hand back.
- **No map, calendar or speech library.** The walks map is SVG over OpenStreetMap tiles, voice uses the
  browser's Web Speech API, and sunrise and sunset come from NOAA's solar equations, written by hand and tested
  against the almanac for Tempe.
- **Sol** is drawn as SVG in code, with moods for a normal day, a hot day, a finished day and listening.
- **Tests and CI.** Vitest tests sit next to the code, and GitHub Actions runs lint, typecheck, tests and the build
  on every pull request.
- **Three people, three Claude Code sessions,** each owning its own folders, with small pull requests into one
  integration branch.

## Challenges we ran into

- **Feed quirks.** The ASU Events feed writes Arizona wall time with a "Z" on the end, so read as UTC every event
  would be 7 hours off; we parse it as local time. Sun Devil Central hides most locations in its public feed ("Sign in to
  download the location"), so many club events have no building to walk to.
- **Arizona time.** No daylight saving, so every time is stored with -07:00 and every date is worked out in
  Arizona time, not the server's.
- **Keeping Sol honest.** Gemini sometimes slipped in stock assistant phrases or named the same assignment twice.
  We gave it only the facts it may use, one line per assignment, and a briefing that still uses a banned phrase is
  thrown away for the plain-code one instead of being spoken.
- **The free tier.** Answers are cached by prompt for an hour, in memory and in Atlas, and each Gemini call gives up
  after 12 seconds so a slow answer cannot stall the screen.
- **Phone photos.** Vercel rejects request bodies over 4.5 MB and phone photos are often bigger, so the setup screen
  shrinks a schedule photo before it uploads it.
- **Next.js 16** changed things we were used to, and importing data from outside the `web/` folder put `next dev` in
  a reload loop, so the app keeps its own copy of the building data, with a test that fails if the two differ.

## Accomplishments that we're proud of

- The demo works with no Canvas token, no event feeds and no Gemini: the sample day and the plain-code fallbacks
  give a full day either way, and the screen says when Gemini was not used.
- "What if…" re-plans the day and Sol's note is computed from the difference between the two plans, so it says
  exactly what moved.
- "How Sol planned this day" shows the real numbers behind every plan instead of asking students to trust a black
  box.
- The Arizona sky timeline follows Tempe's real sunrise and sunset, and the same day reads as a large list for
  students who use zoom or a screen reader.
- The plan reaches the student's own calendar, with a reminder at each leave time, without any calendar library.

## What we learned

- Let the model do language and judgment, and let code do the math. Leave times have to be right every time, so
  they never depend on Gemini.
- A fallback is a feature: because every Gemini step can fail without breaking the day, the app is safer to demo
  on expo Wi-Fi and the free tier.
- Public feeds need reading closely before you trust them: time zones, hidden fields and multi-day "events".
- Writing the shared data shapes first let three people and three AI sessions work in parallel without stepping on
  each other.

## What's next for Sundial

- Connect sundial.club.
- More buildings, and walking times checked against real walks on campus.
- Indoor shortcuts through air-conditioned buildings on hot days.
- Profiles that follow a student across devices.
- Canvas sign-in with OAuth, which needs a developer key issued by ASU.

## Built with

next.js, react, typescript, tailwind-css, node.js, vercel, gemini-api, google-genai-sdk, mongodb-atlas,
web-speech-api, canvas-lms-api, asu-events, sun-devil-central, open-meteo, openstreetmap, overpass-api, icalendar,
vitest, github-actions, claude-code

## AI use and credits

We used Claude Code (Anthropic) as an AI coding assistant throughout: each of us drove our own session,
coordinated through a shared task board. In later rounds Claude agents also acted as reviewers (a mock judge panel,
ASU student personas, a copy critic, a demo coach) and as parallel implementers working from written specs. We
chose what to build and merged every change. The `frontend-design` and `webapp-testing` skills come from
anthropics/skills (Apache-2.0). The app was scaffolded with create-next-app and uses Google's `@google/genai` SDK
for the Gemini API, the MongoDB Node.js driver with a free MongoDB Atlas cluster, and Vitest. Data comes from the
Canvas LMS REST API with each student's own token, the ASU Events feed, the Sun Devil Central public calendar
feed, Open-Meteo (CC BY 4.0) and OpenStreetMap through Overpass (ODbL), including the map tiles under "Your walks".
The iCalendar code follows RFC 5545 and the sunrise math follows NOAA's solar calculation equations, both written
for this project. Fonts are Bricolage Grotesque and Atkinson Hyperlegible Next (SIL Open Font License). Sol and all
artwork were drawn for this project as SVG in code. Full credits are in the README under "AI & attribution".
