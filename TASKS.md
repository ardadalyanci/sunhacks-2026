# Tasks

Update this file when you start or finish something. `[ ]` todo, `[~]` in progress (put your name), `[x]` done.

## A: data + backend + integration (repo owner)
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

## B: UI
- [ ] Design plan with the `frontend-design` skill: palette, type, Sunny's personality
- [ ] Onboarding flow: resume upload, goals, interests, schedule
- [ ] Feed: opportunity cards with "why this fits you" and add-to-plan
- [ ] Weekly plan view: week grid with classes + picks, "Add to Google / Apple Calendar"
- [ ] Two futures screen: side by side, the demo's wow moment
- [ ] Landing page

## C: content, mascot, demo
- [ ] Sunny mascot art (drawn, or generated with Gemini) in `web/public/sunny/`
- [ ] `data/seed-events.json`: 30+ real upcoming ASU opportunities (club, career, social) with real links; format in `data/README.md`
- [ ] Goal + interest taxonomy; 3 demo personas (CS sophomore, international grad student, first-gen business major) with sample resumes
- [ ] Domain via the MLH GoDaddy Registry code; Devpost project draft with all 3 teammates added; prize checklist
- [ ] Demo video (2 minutes max, YouTube), pitch script, expo table plan
- [ ] Talk to sponsors: JFF (Future of Work), TinyFish (API access), MongoDB, MLH
