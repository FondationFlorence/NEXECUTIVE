# Bildup

**Sourced acquisition intelligence for searchers & independent buyers** — the
self-funded searcher, search fund, ETA buyer, or independent sponsor acquiring a single
lower-mid-market European business. Give us your thesis; get a ranked shortlist of
off-market, owner-operated targets with real succession signals — **every signal traced
to its primary source** (Companies House, BODACC, Infogreffe, Firmenbuch, KVK, CRO,
CFNEWS). Verifiability is the product.

Markets: France, UK, Germany, Austria, Netherlands, Ireland — deep, not wide.

The repo contains both the **marketing funnel** (landing page, thesis-first signup,
behavioral nurture, pricing) and the **product** behind it (the authenticated workspace).

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
| `POSTMARK_API_KEY` | no | Sends trial nurture emails (Tue/Thu only) |
| `EMAIL_DRY_RUN` | no | Log emails instead of sending |
| `CONTACT_ENRICH_PROVIDER` | no | Enables contact enrichment (LinkedIn / personal email / phone) via a pluggable provider |
| `CRONS_ENABLED` | no | Set `true` to allow cron jobs to run |

## Local development

```bash
npm install
export DATABASE_URL="postgresql://user:pass@localhost:5432/bildup"
npm run migrate     # creates schema + seeds the target universe
npm run dev         # http://localhost:3000
```

Sign up at `/signup`, then set your thesis at `/onboarding` — you get a ranked, sourced
shortlist immediately (the aha lands before the trial clock matters).

## Routes

**Public:** `GET /` landing · `GET /login` · `GET /signup` · `GET /health` · `/llms.txt`

**Product (auth required):**
- `GET /onboarding` — thesis intake → instant sourced shortlist
- `GET /dashboard` — thesis shortlist (fit score + % thesis match), live sourced signals, pipeline
- `GET /targets` — screening engine; fit score + thesis-match %, registry source links
- `GET /company/:slug` — target detail, score breakdown, sourced signal trail, AI brief, "Verify on <registry>"
- `GET /alerts` — sourced signal feed · `GET /pipeline` — deal board · `GET /settings` — thesis + digest
- Actions: `POST /onboarding`, `/app/watchlist/(add|remove)`, `/app/briefs/generate`, `/app/pipeline/(add|move|remove)`, `/app/settings/(thesis|digest)`

**APIs:** `POST /api/auth/(signup|login|logout)`, `/api/trial-emails/*`, `/webhook/stripe`

## Scoring & matching

- `services/scoring.js` — explainable 0–100 ripeness score for searchers: succession
  window (owner age + availability), consolidation heat, size fit (lower-mid sweet spot),
  cash quality (EBITDA margin), and signal momentum. Deterministic.
- `services/thesis.js` — matches a company to the buyer's thesis (sectors, geographies,
  revenue band, keywords) → 0–100 fit %, and ranks the shortlist.

Every signal and brief links to its primary source — registries for ownership/succession,
CFNEWS for deal activity.

## Key contacts

Each target carries the people to approach (owner / MD / FD). Identity and role come from
the registry officers; `email` is an inferred business pattern; `linkedin_url`,
`personal_email`, and `phone` are enrichment fields filled by a pluggable provider —
wire one in via `services/enrichment.js` + `CONTACT_ENRICH_PROVIDER`. Contacts appear on
the company page and in every deal brief. (Personal contact data on real individuals needs
a lawful basis — legitimate interest for B2B — and erasure handling.)

## Scheduled jobs (cron manifest)

- `jobs/trial-email-scheduler.js` — **behavioral** nurture: activated → upgrade case,
  dormant → a sourced example brief from their thesis. Emails go out **Tuesdays and Thursdays only**.
  `EMAIL_DRY_RUN=true` logs instead of sending (and bypasses the day gate for testing).
- `jobs/signal-monitor.js` — every 6h, emits fresh **sourced** signals across the universe.

Both are gated by `CRONS_ENABLED=true`. (The cron schedule lives in the hosting platform's
manifest; jobs are plain `node` scripts.)

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
