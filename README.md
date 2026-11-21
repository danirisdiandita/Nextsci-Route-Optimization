# Nextsci Route Optimisation

Open-source route planning and optimisation for delivery and field-service teams.

| App | Stack | Path |
| --- | --- | --- |
| API | Django + PostgreSQL | [`backend/`](backend/) |
| Dispatcher web | Vite + React + TypeScript | [`frontend/`](frontend/) |
| Driver app | Expo + React Native | [`mobile/`](mobile/) |

Run the whole stack with `cp .env.example .env && docker compose up --build`.

Setup and commands for each app are in [`AGENTS.md`](AGENTS.md). To verify all three apps, run `./scripts/check.sh`.
