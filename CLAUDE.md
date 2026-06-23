# Nexecutive — CLAUDE.md

## What this app does
Nexecutive is an autonomous M&A intelligence platform for corporate development teams.
AI agents monitor M&A targets, surface opportunities, and deliver executive briefings —
24/7, without manual research.

## Stack
Express.js + EJS + Neon PostgreSQL + Render

## Directory map
- `server.js` — Express entry point (wiring + middleware)
- `lib/` — Shared utilities (landing-context.js, format.js view helpers)
- `migrate.js` — Database migration runner (core tables + folder migrations)
- `db/` — Database access (index.js + per-entity: users, companies, watchlist, alerts, briefs, pipeline, digests)
- `services/` — Business logic (email.js, scoring.js, briefs.js, onboarding.js)
- `jobs/` — Scheduled jobs (trial-email-scheduler.js, signal-monitor.js)
- `routes/` — Express routers (auth.js, app.js [product], checkout.js, trial-emails.js)
- `migrations/` — JS migrations (product_schema, seed_companies)
- `views/` — EJS templates; `views/app/` is the authenticated product; `partials/` are reusable sections
- `public/css/` — Stylesheets (theme.css = landing/auth, app.css = product workspace)

## Product (authenticated, all routes require a session)
- `GET /dashboard` — overview: watchlist (scored), live signals, pipeline summary, stats
- `GET /targets` — Target Screening Engine: filterable universe ranked by fit score
- `GET /company/:slug` — target detail: fundamentals, score breakdown, signals, AI deal brief
- `GET /alerts` — signal feed across the user's watchlist
- `GET /pipeline` — kanban deal pipeline (sourced → screening → diligence → term_sheet → closed/passed)
- `GET /settings` — digest delivery config + account
- Actions: POST /app/watchlist/(add|remove), /app/briefs/generate, /app/pipeline/(add|move|remove), /app/settings/digest

## Engine
- `services/scoring.js` — explainable 0-100 acquisition-fit score (strategic fit, growth, size fit, transactability, signal momentum). Deterministic.
- `services/briefs.js` — Deal Brief Agent. Uses OpenAI (OPENAI_API_KEY, model OPENAI_BRIEF_MODEL) with a deterministic template fallback so it works without a key.
- `jobs/signal-monitor.js` — autonomous monitor that emits fresh sector-aware signals (every 6h via polsia.toml). Real data sources plug in here.

## Database
- `companies` — monitored target universe (sector, country, financials, ownership, sector_heat)
- `users` — accounts; trial_start_date + email_sequence_sent drive the nurture sequence
- `watchlist` — companies a user actively monitors (cached fit_score)
- `alerts` — M&A signals per company (type, severity, regulator)
- `deal_briefs` — generated executive briefings
- `pipeline_deals` — a user's live deal pipeline
- `digest_schedules` — per-user briefing delivery config
- `_migrations` — tracks applied migrations

## Environment variables
- `DATABASE_URL` (required), `SESSION_SECRET` (required in production)
- `OPENAI_API_KEY` (optional — enables narrative briefs), `OPENAI_BRIEF_MODEL` (default gpt-4o-mini)
- `POSTMARK_API_KEY` (trial emails), `POLSIA_IN_PROCESS_CRONS_ENABLED` (gate cron jobs)

## Recent changes
- 2026-06-23 — Built the analysis product behind the landing page: target universe + screening engine (scoring.js), per-company detail with AI deal briefs (briefs.js, OpenAI + template fallback), watchlist, alerts feed, pipeline tracker, digest settings. New tables: companies/watchlist/alerts/deal_briefs/pipeline_deals/digest_schedules + seed. New router routes/app.js, autonomous jobs/signal-monitor.js. New-user onboarding seeds a starter workspace.
- 2026-06-23 — Fixes: added missing trial columns to migrations; corrected getUsersNeedingEmail (trial users have subscription_status='trial', not NULL); added GET /login and /signup pages; middleware/auth exports a callable function; replaced hardcoded SESSION_SECRET fallback (random in dev, required in prod); added urlencoded body parsing + error handler.
- 2026-06-23 — Trial-to-paid email sequence (4-email automation on days 1/7/13/15). API: POST /api/trial-emails/register, POST /api/trial-emails/pause, GET /api/trial-emails/status/:email. Daily cron at 08:00 UTC via polsia.toml.
- 2026-06-23 — Added self-serve pricing section (partials/pricing.ejs). Three tiers (Solo/Team/Enterprise), annual/monthly toggle, no contact-sales.
- 2026-05-?? — Initial landing page build with hero, features, outcomes sections.