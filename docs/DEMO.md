# Demo plan for the expo table

For Barış, Arda and Kerem, judging Sunday from noon to 2 pm.
Live site: https://sunhacks-2026.vercel.app (sundial.club once the domain is connected).

The times below are for the sample student, Diego Ramírez, on Sunday Nov 15. The sample day always replays
8 am, so its numbers stay the same all afternoon ("in 2 h 18 min" does not count down). On another day of the
week his classes and times change. Sol's own sentences (the briefing and the reason under each pick) are written
by Gemini, so they can read a little differently from the quotes below. Everything else on screen is computed by
code and should match exactly.

## Before judging

- [ ] Laptop in Chrome (the mic and the voices work best there), charger plugged in, zoom at 100%, notifications off.
- [ ] Sample day open on Today in a fresh tab: https://sunhacks-2026.vercel.app/today. No setup is saved in this
  browser, so it shows Diego. Check that the headline says "Leave at 10:18 am, Diego." and that every "What if…"
  pill is off.
- [ ] Warm the Gemini cache in the hour before judging, in the demo order: turn on "What if it's 104°?", then
  "What if I oversleep?", then turn off oversleep first and 104° second. Ask "When should I leave?". Type "Add the
  robotics meeting". Press "+ Add" on Sol's pick. Tap "Tomorrow". Gemini answers are kept for 1 hour (in memory and
  in MongoDB Atlas), so the same steps come back fast and do not spend the free-tier quota. If judging runs past
  1 pm, warm it once more.
- [ ] Reset between judges: close the tab and open a new one. Added events and removed study blocks live in that
  tab only (sessionStorage), so a new tab starts the sample day clean. A reload keeps them.
- [ ] Read the line under Sol's briefing. If it says "Gemini is not connected, so Sol planned this with plain
  rules", Gemini is down or rate-limited: see "If Wi-Fi or Gemini fails" below.
- [ ] Phone with the site added to the home screen (Safari: Share, Add to Home Screen; Chrome: Install app). It
  opens straight on Today. Turn on "Show as a list" there in advance if you want the list; the choice is remembered
  on that device.
- [ ] Calendar feed subscribed in advance, from inside the installed phone app: Today, "Add to my calendar", then
  Apple Calendar (or Copy link). Every "What if…" pill must be off: a what-if day is never saved to the calendar,
  and while a pill is on the panel only offers "Download this day (.ics)". Each browser keeps its own calendar id,
  and an iPhone home-screen app keeps its storage apart from Safari, so subscribe from the same place you plan. The
  feed only holds days that were planned there, so open Today and the "Tomorrow" chip on the phone too. Do this at
  least an hour early: calendar apps refresh subscribed feeds on their own schedule.
- [ ] A QR code to https://sunhacks-2026.vercel.app on the table (printed or on a second screen).
- [ ] Phone hotspot ready as backup Wi-Fi, with its name and password written down.
- [ ] Backup video open in a tab and also downloaded to the laptop.
- [ ] Optional, for the MongoDB Atlas prize: the Atlas dashboard open in another tab on the `plans` and
  `gemini_cache` collections.

## The 2-minute demo

One person drives the laptop, one talks. One sentence per beat; let the screen do the rest. Every re-plan shows
"Sol is re-planning your day…" for a moment before Sol's note appears.

| # | Click | Say | The judge sees |
|---|-------|-----|----------------|
| 1 | Nothing: start on Today. | "Sundial plans an ASU student's day. This is Diego, and the first thing he sees is when to leave." | "Leave at 10:18 am, Diego." Under it: "MAT 343 study group at Hayden · 12-minute walk · in 2 h 18 min" and "Walk me there". Sol's briefing is on the right. |
| 2 | "What if it's 104°?" | "Tempe heat is real, so on a hot day every walk starts earlier." | The orange heat banner, "104°F (40°C) now, up to 109°F. Sorry, that's me.", Sol's note "104° out, so I start every walk 2 minutes earlier. You now leave at 10:16 am for Hayden.", and the headline changes to 10:16 am with a 14-minute walk. |
| 3 | "What if I oversleep?" (leave 104° on). | "Plans break. Sol re-plans and tells you what moved. The two hours for Lab 7 get split, never padded." | Sol's note: "104° and up at 9 am: you leave at 10:16 am for Hayden, 2 minutes earlier for the heat. Lab 7 is now 9–10:16 am and 4–4:44 pm and the Reading response is now 4:44–5:29 pm." |
| 3b | Turn off oversleep, then 104°, without talking. | (nothing) | "Back to starting at 8 am: I moved Lab 7 to 8–10 am…", then "Back to 78°: your walks are 2 minutes later again." Headline back to 10:18 am. |
| 4 | Type "When should I leave?" in the box and press Send (or use the mic). | "You can just ask him." | Sol's chat bubble: "Leave at 10:18 am for your MAT 343 study group at Hayden, a 12-minute walk." Code reads it from the plan, so it follows whatever pills are on. |
| 5 | Type or say "Add the robotics meeting". | "And he takes orders. Gemini turns the sentence into an action on the plan." | Sol's bubble: "Added Robotics club build night at 4:15 pm." His note: "Added Robotics club build night, 4:15–5:30 pm. I moved the Reading response to 5:30–6:15 pm." |
| 6 | The "+ Add" button on the dashed "Sol's pick" block on the sky (Lunch & learn, noon). | "Sol also finds club events that fit the gaps in your day, ranked by Gemini against your interests." | "Added Lunch & learn: landing a software internship, noon–12:50 pm, so leave at 11:55 am for MU 202. Nothing else moved." The new leave pin "Leave 11:55 am for the MU, 5 min" is on the sky. |
| 7 | "Play my day". | "The timeline is the Arizona sky, with Tempe's real sunrise and sunset." | Sol rides the sky from 8 am to the end of the day in 14 seconds, with a short caption as he passes each walk and deadline. Press Stop if time is short. |
| 8 | The "Tomorrow" chip, then open "How Sol planned this day" at the bottom. | "From tomorrow on, every pick is a real event from the live ASU feeds. And nothing is a black box: this is what Gemini did and what code did." | "Tomorrow, leave at 10:13 am." for CSE 230 in Brickyard 210, a 17-minute walk. "Fits your day" lists real events from ASU Events and Sun Devil Central. The panel's Events step counts the live events this week and on Monday. |
| 9 | Hand over the phone. | "On a phone it lives on the home screen, and the plan lands in your own calendar." | Tap any block: its details open as a sheet from the bottom of the screen. Then the calendar app with Sundial's events and a reminder at each leave time. |

Close with: "ASU Mobile shows your schedule. Sundial plans your day."

**About Tomorrow's picks (beat 8).** They come from Gemini and the live feeds, so they change. In our test run on
the final build Monday's picks were Innovation Fest (4:30 pm, MU 242), "The Agentic Self with Professor will.i.am"
(6 pm) and a club's general meeting, named with its club (6 pm). Never promise a named event. Read out whatever the first pick is and say
"that's a real event this week". If "Fits your day" is missing on Tomorrow (no live event fits his free time), skip
straight to "How Sol planned this day" and point at the Events step. On today, Sunday, the picks are Diego's 5 sample
events, which the Events page marks "made up for the sample day"; that is why beat 8 uses Tomorrow.

**If you have more time:** scroll to "Your walks" ("2 walks, 17 minutes on foot", every leg on an OpenStreetMap
map with minutes and a Directions link), or tap "Show as a list".

## The 30-second version

1. Today: "Sundial tells an ASU student when to leave. Diego leaves at 10:18 am for a 12-minute walk to Hayden."
2. Click "What if it's 104°?": "On a hot day every walk starts earlier, and Sol says what moved." (10:16 am.)
3. Click "+ Add" on Sol's pick: "Gemini picks club events that fit his free time and his interests."
4. Hold up the phone: "It's on his home screen and in his calendar, with a reminder when it's time to walk."

## The sample day's numbers (Sunday Nov 15, sample clock 8 am)

| State | Headline | Walks | Study blocks | Sky |
|-------|----------|-------|--------------|-----|
| No pills | Leave at 10:18 am | Manzanita to Hayden 12 min, leave 10:18 am; Hayden to the MU 5 min, leave 1:25 pm. "2 walks, 17 minutes on foot." | Lab 7 8–10 am (2 h); Reading response 4–4:45 pm (45 min) | 8 am to 7 pm |
| 104° | Leave at 10:16 am | 14 min, leave 10:16 am; 7 min, leave 1:23 pm. "2 walks, 21 minutes on foot, with extra minutes for the heat." | same as no pills | |
| 104° and oversleep | Leave at 10:16 am | as 104° | Lab 7 9–10:16 am and 4–4:44 pm; Reading response 4:44–5:29 pm | |
| Robotics added | Leave at 10:18 am | as no pills (MU 230 is the same building as the work shift, so no walk) | Reading response 5:30–6:15 pm | |
| Robotics and lunch & learn added | Leave at 10:18 am | 12 min, leave 10:18 am; Hayden to the MU 5 min, leave 11:55 am. Still 2 walks, 17 minutes. | Reading response stays 5:30–6:15 pm (a noon event does not move it) | |
| Tomorrow (Monday) | Tomorrow, leave at 10:13 am | Manzanita to Brickyard 17 min (10:13 am), Brickyard to PSF 16 min (11:59 am), PSF to Brickyard 16 min (2:44 pm). "3 walks, 49 minutes on foot." | Reading response 8–8:45 am; Quiz 5 8:45–9:15 am | 8 am to 10 pm with Innovation Fest as the pick |

Sunrise 6:59 am and sunset 5:26 pm on Sunday; sunrise 7 am and sunset 5:26 pm on Monday. The what-if pills only
show on today, not on later days.

## Who does what

A suggestion; swap if someone's voice is gone.

- **Arda** drives the laptop (screens, design, voice, mascot) and answers questions about the UI and Sol.
- **Barış** talks through the demo and takes the technical questions: the planner, walking times, Gemini, MongoDB
  Atlas, the Canvas token.
- **Kerem** holds the phone (bottom sheet, list view, calendar), keeps the QR code and the hotspot ready, answers
  questions about the event feeds, the weather and the building data, and watches the clock.

## If Wi-Fi or Gemini fails

**Gemini fails or hits the rate limit.** The site keeps working: every Gemini step has a plain-code fallback, and
the screen says "Gemini is not connected, so Sol planned this with plain rules." What changes:

- Sol's briefing comes from a template in code. It starts with the weather and then the next walk, like "It's 78°F
  in Tempe now, with a high of 84°F. Leave at 10:18 am for your MAT 343 study group at Hayden, the first of 2
  things today." Then the work due first and one pick ("I'd check out …").
- Event picks are ranked by matching the student's interests to each event's tags and title, and the reason reads
  like "You picked robotics." The Events page header says "Matched to your interests and free time" instead of
  "Ranked by Gemini".
- Study blocks get 60 minutes per assignment instead of Gemini's estimate.
- "When should I leave?", "What's next?", "How's my day?", "Add the robotics meeting" and "Drop the study block"
  still work, because keyword rules take over. Anything else gets a hint, like "I can tell you how your day looks,
  when to leave, or add an event, like …". Sol never asks a question back.
- Reading a class schedule from a photo or pasted text in Setup needs Gemini and has no fallback. Type the
  classes in instead.
- Leave times, walks, heat, the what-if pills, the map, Play my day and the calendar never used Gemini, so they do
  not change.

Say it plainly: "Gemini is rate-limited right now, so you're seeing the plain-code fallback. The leave times were
never Gemini's job." Each Gemini call gives up after 12 seconds, so on slow Wi-Fi a plan can take up to about 25
seconds (ranking and estimates run together, then the briefing) before the fallback shows. The page itself gives up
after 30 seconds and says "Sol took too long. Try again."

**Wi-Fi is slow or down.** The app says so in plain words instead of breaking:

- A re-plan (a pill or "+ Add") with no connection: "No connection right now. Your day is still here, so try that
  again when you're back online." The day on screen stays.
- Ask Sol with no connection still answers "what's next?" and "when should I leave?" from the plan in memory, like
  "Next is MAT 343 study group at 10:30 am. Leave at 10:18 am for Hayden." "Drop the study block" also works.
  Anything else: "I can't reach the internet right now. Try again when you're back online."
- A day chip that fails puts the picker back on the day on screen and says, for example, "I couldn't plan Monday.
  Check the Wi-Fi and tap Tomorrow again."
- If the first load fails, the page shows "Try again".

The live site still needs the internet to load at all. In this order:

1. Switch the laptop to the phone hotspot.
2. If there is no internet at all, run the app on the laptop: `cd web && npm run dev`, then open
   http://localhost:3000/today. This only works if `npm install` was already done on that laptop. The sample day
   works with no network: it waits 2.5 seconds for the live event feeds, then goes on with Diego's 5 sample events.
   Gemini falls back as above. MongoDB is skipped, so "Add to my calendar" offers "Download this day (.ics)"
   instead of the subscribe links, and the "Saved" step is missing from "How Sol planned this day". The map shows a
   faint grid instead of street tiles. The mic may not work offline in Chrome, so type the question instead.
3. If none of that works, play the backup video.

A real setup on bad Wi-Fi: if Canvas does not answer, Today says "Canvas did not load, so assignments are missing.
Your classes and events are still here." If the weather does not load, there is no heat warning. The Canvas token
`demo` loads sample assignments without calling Canvas.

## Questions judges will ask

**How do you compute walking time, and how accurate is it?**
We take the straight-line distance between the two buildings' centers (52 Tempe buildings from OpenStreetMap),
multiply it by 1.3 because campus paths are not straight, divide by 80 meters a minute (about 3 mph), add 2
minutes to get out of one building and into the next, and round up, never below 3 minutes. On a hot day
(feels-like 95°F or more at any hour from 8 am to 8 pm, from Open-Meteo) every walk gets 2 more minutes. If a
location does not match any building, the walk counts as 10 minutes. Two stops in the same building get no walk
and no leave time when one follows the other within an hour (the lunch & learn in MU 202 and the work shift in
the MU); after a longer break Sol gives a leave time again. If a leave time falls before the
stop before it ends, Sol keeps the honest time and says so in a note that starts "Tight:". Example: Manzanita Hall
to Hayden Library is 568 m in a straight line, so 12 minutes, or 14 on a hot day. It is not turn-by-turn routing:
it does not know doors, stairs, construction or crowds, and we have not timed real walks against it. That is why
"Walk me there" opens Google Maps walking directions for the actual route.

**What does Gemini do, and what is plain code?**
Code does all the math: free gaps from 8 am to 10 pm, leave times, the heat rule, where study blocks go and which
events fit. Gemini does four jobs on Today: it ranks the events that already fit your free time against your
interests and writes one short reason per pick from facts we give it; estimates the minutes each assignment needs
(kept between 15 and 180); writes Sol's briefing (at most 3 short sentences and 50 words); and turns a spoken or
typed sentence into one action on the plan. In Setup it also reads a class schedule from a photo or pasted text.
Every answer must match a JSON schema and use only the ids we offered; a bad answer is thrown away and the
plain-code fallback is used. "When should I leave?" and "What's next?" are answered by code from the plan, not by
Gemini. "How Sol planned this day" says which of these ran for the day on screen.

**Does Sol pad study time?**
No. Gemini's estimate is the most a study block gets: a 45-minute reading is one 45-minute block. A long
assignment can be split across two gaps (Lab 7 becomes 9–10:16 am and 4–4:44 pm when Diego oversleeps), but the
pieces add up to the estimate, and if the time before the due date runs out Sol places less rather than inventing
work. Only Sol's top pick holds its time, and only when that costs no homework time. The other picks are
alternatives, and a study block moves only when the event you add needs its time (Sol's note says where).

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
days ahead); a what-if day is never saved to the feed; and whether the reminder buzzes depends on the calendar
app's own settings and how often it refreshes subscribed feeds.

**What happens to my Canvas token?**
You create it yourself in Canvas (Account, Settings, New Access Token); we never ask for an ASU password. It is kept
in that browser tab only (sessionStorage, gone when the tab closes). When you open Setup again, the form is filled
in, but the token is never put back into the field. When a day is planned, the browser sends it to our server,
which passes it to canvas.asu.edu in a header and does nothing else with it: it is not stored, not logged, and only
ever sent to the Canvas host, even if a pagination link points somewhere else. We read only your planner items from
the planned day to the end of the next day: title, course, due time, link, and whether it is submitted. Sundial
never submits, posts or messages anyone. You can delete the token in Canvas at any time.

**What is stored in MongoDB Atlas?**
Two collections, both cleaned up automatically by TTL indexes:
- `plans`: one document per planned day per calendar id, with the day's date, its timeline items (classes,
  study blocks, events and deadlines, with leave times) and the weather. Never the request, the Canvas token, the
  student's name or the briefing, and never a what-if day. Each is deleted 3 days after that day. The calendar id
  is a random UUID made in the browser, and the feed URL serves up to 14 days from yesterday on.
- `gemini_cache`: Gemini answers, keyed by a SHA-256 hash of the prompt (prompts contain course names), deleted
  after 1 hour. It lets every server instance share answers, which matters on the free tier.

There are no accounts and no profiles: the setup stays in the student's browser. If Atlas is unreachable, the app
waits at most 1.5 seconds, skips the database for a minute and keeps working.

**I removed a study block and it came back. Why?**
Removed blocks are kept per assignment in that browser tab (sessionStorage), so they stay removed through a reload
and a what-if re-plan, and come back in a new tab. The calendar feed is built on the server, which never hears what
was removed, so the panel says "Things you remove from your day stay removed on this device only."

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

**MLH Best Use of Gemini API.** Show the briefing, the reason under each of Sol's picks, "Add the robotics meeting"
and the "Who did what" step in "How Sol planned this day". Point out that Gemini ranks events, estimates homework
time, writes Sol's words, turns speech into actions and reads a schedule photo in Setup, always with JSON schemas,
checks and a plain-code fallback, while the math stays in code.

**MLH Best Use of MongoDB Atlas.** With every pill off, show "Add to my calendar" with the subscribe links, the
"Saved" step in "How Sol planned this day", and the phone's calendar with the feed. If the Atlas dashboard is open,
show the `plans` and `gemini_cache` collections and their TTL indexes: saved days delete themselves 3 days later,
cached answers after 1 hour.

**Best Mascot.** Sol is a sun with pilot goggles, drawn as SVG in code. Show his moods (happy, hot, proud,
listening), "Play my day" where he rides the sky and can be dragged or moved with the arrow keys, his heat banner
("Sorry, that's me."), his note after each what-if, and his voice in "Hear my day".

**Best Diversity/Equality.** Show "Give me more time to walk" in Setup (slower pace, mobility aid, heat
sensitivity), the heat warning with °C next to °F for international students, "Show as a list" for zoom and screen
readers, the Atkinson Hyperlegible font, places named the way students say them ("Hayden", "the MU"), and that
Sundial never asks for an ASU password.

**MLH Best Domain Name from GoDaddy Registry.** sundial.club (once the domain is connected): a sundial tells time by
the sun, and Sol, our sun, tells you when to leave. Show the domain in the address bar if it is live by then.
