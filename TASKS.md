# Tasks

Update this file when you start or finish something. `[ ]` todo, `[~]` in progress (put your name), `[x]` done.

## A: data + backend
- [ ] MongoDB Atlas free cluster; `MONGODB_URI` in `web/.env.local`, shared privately with the team
- [ ] `web/src/lib/db.ts` (Mongo client) and `web/src/lib/gemini.ts` (Gemini client)
- [ ] Import `data/seed-events.json` into the `opportunities` collection
- [ ] Ingest hackathons (MLH season page) and internships (public Greenhouse/Lever boards of Phoenix-area companies)
- [ ] Embeddings + Atlas Vector Search index on opportunities; `POST /api/recommend`
- [ ] Class schedule: Canvas ICS URL to class blocks; screenshot to class blocks via Gemini vision
- [ ] `POST /api/plan`: place top picks into free slots around classes
- [ ] `GET /api/calendar/[studentId]`: ICS feed for Google + Apple Calendar
- [ ] `POST /api/futures`: two futures from resume + plan
- [ ] TinyFish agent for SunDevilCentral events (after the 16:30 TinyFish workshop)
- [ ] Deploy (AWS Amplify if we have an account, otherwise Vultr) + custom domain

## B: UI (repo owner)
Screens run on mock data from `web/src/mocks/demo.ts` until A's APIs exist.
- [x] Design plan: "Arizona sky" (time of day is color), Bricolage Grotesque + Atkinson Hyperlegible Next, tokens in `globals.css`
- [x] Landing page (`/`)
- [x] Onboarding flow (`/onboarding`): resume, goal, interests, Canvas link or screenshot (not wired to the backend yet)
- [x] Weekly plan (`/week`): sky week grid with classes + picks, detail panel with "why", Google / Apple Calendar buttons
- [x] Discover feed (`/discover`): picks by day with "why this fits you", add to week, deadlines column
- [x] Two futures (`/futures`): overcast vs golden horizons, Sunny rises on the golden side
- [ ] Wire each screen to A's APIs (`/api/recommend`, `/api/plan`, `/api/futures`, `/api/calendar/[studentId]`)
- [ ] Demo persona switcher (3 personas from C)
- [ ] Swap the placeholder Sunny for C's art
- [ ] Phone pass: check every screen at 375px wide

## C: content, mascot, demo
- [ ] Sunny mascot art (drawn, or generated with Gemini) in `web/public/sunny/`
- [ ] `data/seed-events.json`: 30+ real upcoming ASU opportunities (club, career, social) with real links; format in `data/README.md`
- [ ] Goal + interest taxonomy; 3 demo personas (CS sophomore, international grad student, first-gen business major) with sample resumes
- [ ] Domain via the MLH GoDaddy Registry code; Devpost project draft with all 3 teammates added; prize checklist
- [ ] Demo video (2 minutes max, YouTube), pitch script, expo table plan
- [ ] Talk to sponsors: JFF (Future of Work), TinyFish (API access), MongoDB, MLH
