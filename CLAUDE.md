# Nexecutive — CLAUDE.md

## What this app does
Nexecutive is an autonomous M&A intelligence platform for corporate development teams.
AI agents monitor M&A targets, surface opportunities, and deliver executive briefings —
24/7, without manual research.

## Stack
Express.js + EJS + Neon PostgreSQL + Render

## Directory map
- `server.js` — Express entry point (wiring + middleware, under 300 lines)
- `lib/` — Shared library utilities (landing context builder)
- `migrate.js` — Database migration runner
- `db/` — Database access (index.js + per-entity files)
- `services/` — Business logic services (email.js)
- `jobs/` — Scheduled job scripts (trial-email-scheduler.js)
- `routes/` — Express routers (checkout.js, trial-emails.js)
- `migrations/` — SQL/JS migrations (one per change)
- `views/` — EJS templates; `partials/` contains reusable section components
- `public/css/` — Site stylesheet (theme.css)
- `session-env/` — Session/env tooling (internal)

## Database
- `companies` — M&A target companies being monitored
- `users` — Team members (linked to subscription seats)
- `alerts` — M&A signal alerts generated per company
- `digest_schedules` — Per-user briefing delivery config
- `_migrations` — Tracks applied migrations

## Recent changes
- 2026-06-23 — Trial-to-paid email sequence (4-email automation on days 1/7/13/15). API: POST /api/trial-emails/register, POST /api/trial-emails/pause, GET /api/trial-emails/status/:email. Daily cron at 08:00 UTC via polsia.toml.
- 2026-06-23 — Added self-serve pricing section (partials/pricing.ejs). Three tiers (Solo/Team/Enterprise), annual/monthly toggle, no contact-sales.
- 2026-05-?? — Initial landing page build with hero, features, outcomes sections.