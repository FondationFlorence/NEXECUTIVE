# Nexecutive

Autonomous **M&A deal-intelligence platform** for European mid-market deal teams —
M&A lawyers, corporate development, and business development. It monitors a target
universe, scores acquisition fit, surfaces signals, generates executive deal briefs,
and tracks a live pipeline.

The repo contains both the **marketing funnel** (landing page, trial signup, nurture
emails, pricing) and the **product** behind it (the authenticated workspace).

## Stack

Express.js · EJS · PostgreSQL (Neon) · Render · optional OpenAI for briefs

## Requirements

- Node.js 20+
- PostgreSQL database

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | prod | Session signing secret (random ephemeral in dev if unset) |
| `PORT` | no | Server port (default 3000) |
| `OPENAI_API_KEY` | no | Enables narrative deal briefs (falls back to a template engine) |
| `OPENAI_BRIEF_MODEL` | no | Brief model (default `gpt-4o-mini`) |
| `POSTMARK_API_KEY` | no | Sends trial nurture emails |
| `POLSIA_IN_PROCESS_CRONS_ENABLED` | no | Set `true` to allow cron jobs to run |

## Local development

```bash
npm install
export DATABASE_URL="postgresql://user:pass@localhost:5432/nexecutive"
npm run migrate     # creates schema + seeds the target universe
npm run dev         # http://localhost:3000
```

Create an account at `/signup` — a new account is seeded with a starter watchlist,
pipeline, and weekly digest so the workspace is immediately useful.

## Routes

**Public:** `GET /` landing · `GET /login` · `GET /signup` · `GET /health`

**Product (auth required):**
- `GET /dashboard` — overview: watchlist, live signals, pipeline, stats
- `GET /targets` — screening engine over the universe, ranked by fit score
- `GET /company/:slug` — target detail, score breakdown, signals, AI deal brief
- `GET /alerts` — signal feed · `GET /pipeline` — deal board · `GET /settings`
- Actions: `POST /app/watchlist/(add|remove)`, `/app/briefs/generate`, `/app/pipeline/(add|move|remove)`, `/app/settings/digest`

**APIs:** `POST /api/auth/(signup|login|logout)`, `/api/trial-emails/*`, `/webhook/stripe`

## Scoring engine

`services/scoring.js` produces an explainable 0–100 acquisition-fit score from five
weighted components: strategic fit (sector heat), growth, size fit (mid-market sweet
spot), transactability (ownership), and signal momentum. Deterministic — the same
inputs always produce the same score and breakdown.

## Scheduled jobs (`polsia.toml`)

- `jobs/trial-email-scheduler.js` — daily 08:00 UTC, trial nurture emails (days 1/7/13/15)
- `jobs/signal-monitor.js` — every 6h, emits fresh M&A signals across the universe

Both are gated by `POLSIA_IN_PROCESS_CRONS_ENABLED=true`.

## Layout

```
server.js              Express app (wiring)
migrate.js             migration runner (core tables + migrations/)
migrations/            product schema + seed
db/                    pool + per-entity query modules
services/              scoring, briefs, email, onboarding
jobs/                  scheduled scripts
routes/                auth, app (product), checkout, trial-emails
views/                 landing + auth (root) and product (views/app/)
public/css/            theme.css (landing) + app.css (product)
lib/                   landing-context, format helpers
```

## Deployment

Configured for Render via `render.yaml`. `npm run build` runs migrations on deploy.
