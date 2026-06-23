/**
 * Core product schema for the M&A intelligence platform.
 *
 *   companies        — the monitored target universe
 *   watchlist        — companies a given user is actively monitoring
 *   alerts           — M&A signals generated per company
 *   deal_briefs      — AI-generated executive briefings
 *   pipeline_deals   — a user's live deal pipeline
 *   digest_schedules — per-user briefing delivery config
 */
module.exports = {
  name: 'product_schema',
  up: async (client) => {
    // --- Target universe ------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id            SERIAL PRIMARY KEY,
        slug          VARCHAR(255) UNIQUE NOT NULL,
        name          VARCHAR(255) NOT NULL,
        sector        VARCHAR(100) NOT NULL,
        country       VARCHAR(100) NOT NULL,
        hq_city       VARCHAR(100),
        employees     INTEGER,
        revenue_eur   BIGINT,
        arr_eur       BIGINT,
        funding_stage VARCHAR(60),
        valuation_eur BIGINT,
        ownership     VARCHAR(40),
        founded_year  INTEGER,
        growth_rate   NUMERIC(5,1),
        sector_heat   INTEGER DEFAULT 50,
        description   TEXT,
        website       VARCHAR(255),
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS companies_sector_idx  ON companies (sector)`);
    await client.query(`CREATE INDEX IF NOT EXISTS companies_country_idx ON companies (country)`);

    // --- Per-user watchlist --------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        fit_score  INTEGER,
        added_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, company_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS watchlist_user_idx ON watchlist (user_id)`);

    // --- M&A signal alerts ---------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id          SERIAL PRIMARY KEY,
        company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        type        VARCHAR(40) NOT NULL,
        severity    VARCHAR(20) NOT NULL DEFAULT 'medium',
        title       VARCHAR(255) NOT NULL,
        detail      TEXT,
        source      VARCHAR(120),
        regulator   VARCHAR(40),
        signal_date TIMESTAMPTZ DEFAULT NOW(),
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS alerts_company_idx ON alerts (company_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS alerts_date_idx    ON alerts (signal_date DESC)`);

    // --- AI deal briefs -------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS deal_briefs (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        content    TEXT NOT NULL,
        model      VARCHAR(60),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS deal_briefs_company_idx ON deal_briefs (company_id)`);

    // --- Pipeline tracker ----------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS pipeline_deals (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        stage      VARCHAR(30) NOT NULL DEFAULT 'sourced',
        owner      VARCHAR(120),
        next_step  VARCHAR(255),
        notes      TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, company_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS pipeline_user_idx ON pipeline_deals (user_id)`);

    // --- Digest delivery config ----------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS digest_schedules (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        frequency  VARCHAR(20) NOT NULL DEFAULT 'weekly',
        hour_utc   INTEGER NOT NULL DEFAULT 8,
        enabled    BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  },
};
