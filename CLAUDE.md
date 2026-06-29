# Bildup — CLAUDE.md

## What this app does
Bildup is sourced acquisition intelligence for **one buyer**: the searcher / ETA /
independent sponsor acquiring a single lower-mid-market European business. It surfaces
off-market, owner-operated targets with real succession signals, ranks them against the
buyer's thesis, and traces **every signal to its primary source** (Companies House,
BODACC, Infogreffe, Firmenbuch, KVK, CRO, CFNEWS). Verifiability is the product.

Positioning bets (single ICP, one product, one pain):
1. One buyer — searcher/ETA/sponsor. (Dropped the lawyer + corp-dev ICPs.)
2. Verifiability = product. Every claim links to an official document. Depth over a
   "3.2M companies" vanity count.
3. Activation inverted: thesis in → sourced shortlist out, immediately (`/onboarding`).
4. Channel: Meta Pixel removed; lean on GEO/AEO (structured data, FAQ, `public/llms.txt`).
5. Behavioral nurture: activated → upgrade case; dormant → tailored sourced example brief.

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
- `GET /onboarding` — thesis intake → instant sourced shortlist (the activation aha)
- `GET /dashboard` — overview: thesis shortlist (scored + % thesis fit), live sourced signals, pipeline, stats
- `GET /targets` — screening engine: filterable universe, fit score + thesis-match %, registry source links
- `GET /company/:slug` — target detail: fundamentals (EBITDA/owner age/availability), score breakdown, sourced signal trail, AI brief, "Verify on <registry>"
- `GET /alerts` — sourced signal feed (every alert links to its primary source)
- `GET /pipeline` — kanban deal pipeline (sourced → screening → diligence → term_sheet → closed/passed)
- `GET /settings` — acquisition thesis editor + digest config + account
- Actions: POST /onboarding, /app/watchlist/(add|remove), /app/briefs/generate, /app/pipeline/(add|move|remove), /app/settings/(thesis|digest). Watchlist-add, brief-generate, pipeline-add mark the user activated.

## Engine
- `services/scoring.js` — explainable 0-100 ripeness score for searchers: succession window (owner age + availability), consolidation heat, size fit (lower-mid sweet spot), cash quality (EBITDA margin), signal momentum. Deterministic.
- `services/thesis.js` — matches a company to the buyer's thesis (sectors/countries/revenue band/keywords) → 0-100 fit %, and ranks the shortlist.
- `services/briefs.js` — Deal Brief Agent. Cites primary sources (Sources section with links). OpenAI (OPENAI_API_KEY, OPENAI_BRIEF_MODEL) + deterministic template fallback.
- `services/onboarding.js` — builds the sourced shortlist from a thesis into the workspace.
- `jobs/signal-monitor.js` — autonomous monitor; emits fresh SOURCED signals (registry or CFNEWS) every 6h.
- `jobs/trial-email-scheduler.js` — behavioral nurture (activated vs dormant), daily. `EMAIL_DRY_RUN=true` logs instead of sending.

## Database
- `companies` — target universe; financials + ebitda_eur, owner_age, availability, registry, registry_url
- `users` — accounts; trial_start_date, email_sequence_sent, activated_at, behavioral_email_sent
- `theses` — per-user acquisition thesis (sectors[], countries[], rev_min/max, keywords)
- `contacts` — key people per company (name, role, email, linkedin_url, personal_email, phone, source)
- `watchlist` — the user's shortlist (cached fit_score)
- `alerts` — signals per company (type, severity, source, **source_url**, regulator)
- `deal_briefs` — generated sourced briefings
- `pipeline_deals` — the live pipeline
- `digest_schedules` — per-user briefing delivery config
- `_migrations` — tracks applied migrations

## Environment variables
- `DATABASE_URL` (required), `SESSION_SECRET` (required in production)
- `OPENAI_API_KEY` (optional — enables narrative briefs), `OPENAI_BRIEF_MODEL` (default gpt-4o-mini)
- `POSTMARK_API_KEY` (nurture emails, Tue/Thu only), `EMAIL_DRY_RUN` (log instead of send), `CRONS_ENABLED` (gate cron jobs)
- `CONTACT_ENRICH_PROVIDER` (optional — enables contact enrichment via a pluggable provider)

## Recent changes
- 2026-06-24 — Brand + pricing + contacts pass. New visual identity (brand charter): light theme, royal blue #2756C9, Spectral/Hanken Grotesk/IBM Plex Mono, logo assets in public/brand/ (favicon = monogram); theme.css re-skinned via token swap. Pricing re-architected to Searcher €299 / Sponsor €999 / Firm from €1,800 (sales-assisted). Behavioral emails now send Tue/Thu only. Deal briefs + company pages now list key contacts (name, role, email, LinkedIn, personal email) via contacts table + services/enrichment.js (pluggable provider, GDPR-aware). Removed all Polsia notions from app code (analytics beacon, polsia.app domain → bildup.com, POLSIA_* env → CRONS_ENABLED, footer credit); the cron manifest file remains the platform's scheduler config.
- 2026-06-23 — Strategic pivot to one ICP (searcher/ETA/sponsor) with verifiability as the product. Every signal carries source + source_url (registries + CFNEWS); seed re-built for European lower-mid-market targets (FR/UK/DE/AT/NL/IE). New: thesis intake → instant shortlist (/onboarding, services/thesis.js, theses table). Scoring re-tuned around succession. Briefs cite sources. Behavioral email nurture (activated/dormant) replaces the fixed-day cadence; activation tracked. Removed Meta Pixel; added public/llms.txt for AEO. Pricing reframed (Searcher/Fund/Sponsor) + FAQ schema rewritten.
- 2026-06-23 — Built the analysis product behind the landing page: target universe + screening engine (scoring.js), per-company detail with AI deal briefs (briefs.js, OpenAI + template fallback), watchlist, alerts feed, pipeline tracker, digest settings. New tables + seed. New router routes/app.js, autonomous jobs/signal-monitor.js.
- 2026-06-23 — Fixes: added missing trial columns to migrations; corrected getUsersNeedingEmail (trial users have subscription_status='trial', not NULL); added GET /login and /signup pages; middleware/auth exports a callable function; replaced hardcoded SESSION_SECRET fallback (random in dev, required in prod); added urlencoded body parsing + error handler.
- 2026-06-23 — Trial-to-paid email sequence (4-email automation on days 1/7/13/15). API: POST /api/trial-emails/register, POST /api/trial-emails/pause, GET /api/trial-emails/status/:email. Daily cron at 08:00 UTC via polsia.toml.
- 2026-06-23 — Added self-serve pricing section (partials/pricing.ejs). Three tiers (Solo/Team/Enterprise), annual/monthly toggle, no contact-sales.
- 2026-05-?? — Initial landing page build with hero, features, outcomes sections.