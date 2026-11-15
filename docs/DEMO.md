# Demo plan for the expo table

For Barış, Arda and Kerem, judging Sunday from noon to 2 pm.
Live site: https://sunhacks-2026.vercel.app (sundial.club once the domain is connected).

The times below are for the sample student, Diego Ramírez, on Sunday Nov 15. The sample day always replays
8:00 am, so its numbers stay the same all afternoon. On another day of the week his classes and times change.

## Before judging

- [ ] Laptop in Chrome (the mic and the voices work best there), charger plugged in, zoom at 100%, notifications off.
- [ ] Sample day open on Today: https://sunhacks-2026.vercel.app/today. No setup is saved in this browser, so it
  shows Diego. Check that the headline says "Leave at 10:18 am, Diego." and that every "What if…" pill is off.
- [ ] Warm the Gemini cache in the hour before judging: load the sample day, turn each pill on and off once, and
  ask "When should I leave?" once. Gemini answers are kept for 1 hour (in memory and in MongoDB Atlas), so the
  same questions come back fast and do not spend the free-tier quota. After that, stop clicking around.
- [ ] Read the line under Sol's briefing. If it says "Gemini is not connected, so Sol planned this with plain
  rules", Gemini is down or rate-limited: see "If Wi-Fi or Gemini fails" below.
- [ ] Phone with the site added to the home screen (Safari: Share, Add to Home Screen; Chrome: Install app). It
  opens straight on Today. Turn on "Show as a list" there in advance; the choice is remembered on that device.
- [ ] Calendar feed subscribed in advance, from inside the installed phone app: Today, "Add to my calendar", then
  Apple Calendar (or Copy link). Each browser keeps its own calendar id, and an iPhone home-screen app keeps its
  storage apart from Safari, so subscribe from the same place you plan. The feed only holds days that were planned
  there, so open Today and the "Mon 16" chip on the phone too. Do this at least an hour early: calendar apps refresh
  subscribed feeds on their own schedule.
- [ ] A QR code to https://sunhacks-2026.vercel.app on the table (printed or on a second screen).
- [ ] Phone hotspot ready as backup Wi-Fi, with its name and password written down.
- [ ] Backup video open in a tab and also downloaded to the laptop.
- [ ] Optional, for the MongoDB Atlas prize: the Atlas dashboard open in another tab on the `plans` and
  `gemini_cache` collections.

## The 2-minute demo

One person drives the laptop, one talks. One sentence per beat; let the screen do the rest.

| # | Click | Say | The judge sees |
|---|-------|-----|----------------|
| 1 | Nothing: start on Today. | "Sundial plans an ASU student's day. This is Diego, and the first thing he sees is when to leave." | "Leave at 10:18 am, Diego." Under it: Study group: MAT 343 at Hayden, 12-minute walk, a countdown and "Walk me there". |
| 2 | "What if it's 104°?" | "Tempe heat is real, so on a hot day every walk starts earlier." | The orange heat banner ("104°F (40°C) now, up to 109°F. Sorry, that's me.") and Sol's note: "104° out, so I start every walk 2 minutes earlier", with the new leave time, 10:16 am. |
| 3 | "What if I oversleep?" | "Plans break. Sol re-plans and tells you what moved." | Sol's note starts "Up at 9 am instead of 8 am" and says where the study time went. The timeline moves with it. |
| 4 | Type "When should I leave?" in the box and press Send (or use the mic). | "You can just ask him." | Sol answers in a chat bubble with the next leave time, the place and the walk minutes, read from the plan by code. The answer follows whatever pills are on. |
| 5 | The dashed "+ Add" block on the sky. | "Sol also finds club events that fit the gaps in your day, ranked by Gemini against your interests." | The event joins the day with its own leave time, and Sol's note says when to leave for it. |
| 6 | "Play my day". | "The timeline is the Arizona sky, with Tempe's real sunrise and sunset." | Sol rides the sky through the day in 14 seconds, stopping on each walk and deadline. Press Stop if time is short. |
| 7 | Scroll to "Your walks". | "Every walk is on a map, with the minutes for each leg." | OpenStreetMap tiles under the route, minutes per leg, and a Directions link for each walk. |
| 8 | Open "How Sol planned this day" at the bottom. | "Nothing is a black box: this is what Gemini did and what plain code did, with this day's numbers." | The steps: schedule, assignments, walks, weather, study time, events, who did what, saved in MongoDB Atlas. |
| 9 | Hand over the phone. | "On a phone it lives on the home screen, and the plan lands in your own calendar." | The day as a large list, then the calendar app with Sundial's events and a reminder at each leave time. |

Close with: "ASU Mobile shows your schedule. Sundial plans your day."

## The 30-second version

1. Today: "Sundial tells an ASU student when to leave. Diego leaves at 10:18 am for a 12-minute walk to Hayden."
2. Click "What if it's 104°?": "On a hot day every walk starts earlier, and Sol says what moved."
3. Click "+ Add" on the dashed block: "Gemini picks club events that fit his free time and his interests."
4. Hold up the phone: "It's on his home screen and in his calendar, with a reminder when it's time to walk."

## Who does what

A suggestion; swap if someone's voice is gone.

- **Arda** drives the laptop (screens, design, voice, mascot) and answers questions about the UI and Sol.
- **Barış** talks through the demo and takes the technical questions: the planner, walking times, Gemini, MongoDB
  Atlas, the Canvas token.
- **Kerem** holds the phone (list view, calendar), keeps the QR code and the hotspot ready, answers questions about
  the event feeds, the weather and the building data, and watches the clock.

## If Wi-Fi or Gemini fails

**Gemini fails or hits the rate limit.** The site keeps working: every Gemini step has a plain-code fallback, and
the screen says "Gemini is not connected, so Sol planned this with plain rules." What changes:

- Sol's briefing comes from a template in code instead of Gemini's words.
- Event picks are ranked by matching the student's interests to each event's tags and title, and the reason
  reads like "Matches your interest in robotics."
- Study blocks get 60 minutes per assignment instead of Gemini's estimate.
- "When should I leave?", "What's next?", "How's my day?", "Add the robotics meeting" and "Drop the study block"
  still work, because keyword rules take over. Anything else gets a hint to try "How's my day?" or "Add the
  robotics meeting".
- Reading a class schedule from a photo or pasted text in Setup needs Gemini and has no fallback. Type the
  classes in instead.
- Leave times, walks, heat, the what-if pills, the map, Play my day and the calendar never used Gemini, so they do
  not change.

Say it plainly: "Gemini is rate-limited right now, so you're seeing the plain-code fallback. The leave times were
never Gemini's job." Each Gemini call gives up after 12 seconds, so on slow Wi-Fi a plan can take up to about 25
seconds (ranking and estimates run together, then the briefing) before the fallback shows.

**Wi-Fi is slow or down.** The live site needs the internet. In this order:

1. Switch the laptop to the phone hotspot.
2. If there is no internet at all, run the app on the laptop: `cd web && npm run dev`, then open
   http://localhost:3000/today. This only works if `npm install` was already done on that laptop. The sample day
   works with no network: it waits 2.5 seconds for the live event feeds, then goes on with Diego's 5 sample events.
   Gemini falls back as above. MongoDB is skipped, so "Add to my calendar" offers "Download this day (.ics)"
   instead of the subscribe links, and the "Saved" step is missing from "How Sol planned this day". The map shows a
   faint grid instead of street tiles. The mic may not work offline in Chrome, so type the question instead.
3. If none of that works, play the backup video.

A real setup on bad Wi-Fi: if Canvas does not answer, Today says "Canvas did not load: … Your classes and events
are still here." If the weather does not load, there is no heat warning. The Canvas token `demo` loads sample
assignments without calling Canvas.

## Questions judges will ask

**How do you compute walking time, and how accurate is it?**
We take the straight-line distance between the two buildings' centers (52 Tempe buildings from OpenStreetMap),
multiply it by 1.3 because campus paths are not straight, divide by 80 meters a minute (about 3 mph), add 2
minutes to get out of one building and into the next, and round up, never below 3 minutes. On a hot day
(feels-like 95°F or more at any hour from 8 am to 8 pm, from Open-Meteo) every walk gets 2 more minutes. If a
location does not match any building, the walk counts as 10 minutes. Example: Manzanita Hall to Hayden Library is
568 m in a straight line, so 12 minutes, or 14 on a hot day. It is not turn-by-turn routing: it does not know
doors, stairs, construction or crowds, and we have not timed real walks against it. That is why "Walk me there"
opens Google Maps walking directions for the actual route.

**What does Gemini do, and what is plain code?**
Code does all the math: free gaps from 8 am to 10 pm, leave times, the heat rule, where study blocks go and which
events fit. Gemini does four jobs on Today: it ranks the events that already fit your free time against your
interests and writes one reason per pick from facts we give it; estimates the minutes each assignment needs
(kept between 15 and 180); writes Sol's briefing (at most 3 short sentences and 50 words); and turns a spoken or
typed sentence into one action on the plan. In Setup it also reads a class schedule from a photo or pasted text.
Every answer must match a JSON schema and use only the ids we offered; a bad answer is thrown away and the
plain-code fallback is used. "When should I leave?" is answered by code from the plan, not by Gemini. "How Sol
planned this day" says which of these ran for the day on screen.

**Why not just Google Calendar or ASU Mobile?**
A calendar holds the times you type in. It does not know which Canvas assignments are still not turned in, how far
Hayden is from Brickyard, whether it is 104° out, or which club events fit between your classes. Sundial works
those out and then puts the result into Google or Apple Calendar, so it adds to what students already use. Our
line: ASU Mobile shows your schedule; Sundial plans your day.

**There are no push notifications. How does a leave time reach the student?**
Three ways. Today opens on the next walk with a live countdown, and the site installs to the home screen. The
calendar feed puts every planned day into Google or Apple Calendar, with a reminder at each leave time ("Leave now
for …") and the walk minutes in the event notes. And "Download this day (.ics)" works even without the database.
The honest limits: a day reaches the feed when Sundial plans it, which happens when you open that day (up to 6
days ahead), and whether the reminder buzzes depends on the calendar app's own settings and how often it refreshes
subscribed feeds.

**What happens to my Canvas token?**
You create it yourself in Canvas (Account, Settings, New Access Token); we never ask for an ASU password. It is kept
in that browser tab only (sessionStorage, gone when the tab closes). When a day is planned, the browser sends it to
our server, which passes it to canvas.asu.edu in a header and does nothing else with it: it is not stored, not
logged, and only ever sent to the Canvas host, even if a pagination link points somewhere else. We read only your
planner items from the planned day to the end of the next day: title, course, due time, link, and whether it is
submitted. Sundial never submits, posts or messages anyone. You can delete the token in Canvas at any time.

**What is stored in MongoDB Atlas?**
Two collections, both cleaned up automatically by TTL indexes:
- `plans`: one document per planned day per calendar id, with the day's date, its timeline items (classes,
  study blocks, events and deadlines, with leave times) and the weather. Never the request, the Canvas token, the
  student's name or the briefing. Each is deleted 3 days after that day. The calendar id is a random UUID made in
  the browser, and the feed URL serves up to 14 days from yesterday on.
- `gemini_cache`: Gemini answers, keyed by a SHA-256 hash of the prompt (prompts contain course names), deleted
  after 1 hour. It lets every server instance share answers, which matters on the free tier.

There are no accounts and no profiles: the setup stays in the student's browser. If Atlas is unreachable, the app
waits at most 1.5 seconds, skips the database for a minute and keeps working.

**How is this different from last year's Canvas projects?**
Last year's winners Edwin (a Canvas AI TA) and Plz_use_it (a Canvas and calendar study scheduler) worked on the
coursework. For us Canvas is one input. Sundial plans the physical day: when to walk where on a hot campus, study
time around your classes, and club events from two live ASU feeds that fit your gaps, with what-ifs that re-plan the
day and say what moved.

**What does "Give me more time to walk" change?**
It is for a slower pace, a mobility aid, or heat that hits hard. Every walk takes 35% longer, and a hot day adds 5
minutes instead of 2. It applies to every walk, including the one to a suggested event, and Gemini is told never
to tell that student to hurry. Example: Manzanita to Hayden goes from 12 to 15 minutes, and on a hot day from 14 to
20.

**How did you use AI to build it?**
Each of us drove our own Claude Code session, coordinated through a shared task board. Later, Claude agents also
acted as reviewers (a mock judge panel, ASU student personas, a copy critic, a demo coach) and as parallel
implementers working from written specs. We chose what to build and merged every change. It is all credited in the
README under "AI & attribution".

**What's next?**
Connecting sundial.club. More buildings than 52, and walking times checked against real walks. Indoor shortcuts
through air-conditioned buildings on hot days. Profiles that follow a student across devices. Canvas sign-in with
OAuth, which needs a developer key issued by ASU.

## Prizes we are going for

**MLH Best Use of Gemini API.** Show the briefing, the reason under each of Sol's picks, "When should I leave?" and
the "Who did what" step in "How Sol planned this day". Point out that Gemini ranks events, estimates homework time,
writes Sol's words, turns speech into actions and reads a schedule photo in Setup, always with JSON schemas, checks
and a plain-code fallback, while the math stays in code.

**MLH Best Use of MongoDB Atlas.** Show "Add to my calendar" with the subscribe links, the "Saved" step in "How Sol
planned this day", and the phone's calendar with the feed. If the Atlas dashboard is open, show the `plans` and
`gemini_cache` collections and their TTL indexes: saved days delete themselves 3 days later, cached answers after 1
hour.

**Best Mascot.** Sol is a sun with pilot goggles, drawn as SVG in code. Show his moods (happy, hot, proud,
listening), "Play my day" where he rides the sky and can be dragged or moved with the arrow keys, his heat banner
("Sorry, that's me."), his note after each what-if, and his voice in "Hear my day".

**Best Diversity/Equality.** Show "Give me more time to walk" in Setup (slower pace, mobility aid, heat
sensitivity), the heat warning with °C next to °F for international students, "Show as a list" for zoom and screen
readers, the Atkinson Hyperlegible font, places named the way students say them ("Hayden", "the MU"), and that
Sundial never asks for an ASU password.

**MLH Best Domain Name from GoDaddy Registry.** sundial.club (once the domain is connected): a sundial tells time by
the sun, and Sol, our sun, tells you when to leave. Show the domain in the address bar if it is live by then.
