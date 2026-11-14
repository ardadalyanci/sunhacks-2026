# Sunny: the AI copilot for ASU students

Sunny knows your goals, your classes and what you like. It finds the club events, career fairs, hackathons and internships worth your time, fits them into your week and puts them on your calendar. Then it shows you two futures: you next May if nothing changes, and you with the plan.

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
