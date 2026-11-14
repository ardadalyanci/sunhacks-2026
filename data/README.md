# data/

Seed files that teammate A imports into MongoDB.

## seed-events.json
Real, upcoming opportunities collected by hand until the TinyFish agent runs. One JSON array; each object follows `Opportunity` in `web/src/lib/types.ts`, minus `id` and `fetchedAt` (the importer adds those).

Required fields: `kind`, `title`, `organizer`, `description`, `url` (a real link), `tags`, `source: "seed"`, and `startsAt` for events or `deadline` for internships. Times use the Arizona offset `-07:00`.

```json
[
  {
    "kind": "club_event",
    "title": "Example: Software Developers Association general meeting",
    "organizer": "Software Developers Association at ASU",
    "description": "One or two sentences copied or summarized from the event page.",
    "url": "https://sundevilcentral.eoss.asu.edu/event/...",
    "startsAt": "2026-11-18T18:00:00-07:00",
    "endsAt": "2026-11-18T19:30:00-07:00",
    "location": "BYENG 210",
    "tags": ["software", "networking"],
    "source": "seed"
  }
]
```
