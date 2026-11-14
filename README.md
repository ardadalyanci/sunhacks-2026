# DayPilot: your day at ASU, planned

ASU Mobile shows you information. DayPilot plans your day: your classes, your Canvas due dates, the Tempe heat and the club events you would actually go to, in one plan you can talk to. It tells you when to leave for class, saves time for the assignment due tonight, warns you before a hot walk, and adds events by voice.

Built at sunhacks 9.0 (November 14-15, 2026, ASU Tempe). Work in progress during the hackathon.

## Run it locally
```bash
cd web
cp .env.example .env.local   # then fill in your own keys
npm install
npm run dev                  # http://localhost:3000
```

## Team
<!-- names and GitHub handles -->

## AI & attribution
- The team used Claude Code (Anthropic) as an AI coding assistant; generated code was reviewed by the team.
- Claude skills vendored in `.claude/skills/`: `frontend-design` and `webapp-testing` from [anthropics/skills](https://github.com/anthropics/skills), Apache-2.0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- App scaffolded with `create-next-app` (Next.js 16).
- Data sources and APIs are listed here as we add them, with links and licenses.
