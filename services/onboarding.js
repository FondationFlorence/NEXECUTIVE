/**
 * New-user onboarding: give a fresh trial account an immediately useful
 * workspace — a starter watchlist of high-signal targets, a couple of
 * pipeline entries, and a default weekly digest. Best-effort: callers should
 * not let a seeding failure block signup.
 */
const { pool } = require('../db/index');
const watchlist = require('../db/watchlist');
const pipeline = require('../db/pipeline');
const digests = require('../db/digests');
const alerts = require('../db/alerts');
const { scoreCompany } = require('./scoring');

/** Pick the most interesting targets: high sector heat with live signals. */
async function pickStarterCompanies(limit = 6) {
  const r = await pool.query(
    `SELECT c.*, COALESCE(a.cnt, 0) AS alert_count
       FROM companies c
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS cnt FROM alerts al
          WHERE al.company_id = c.id AND al.signal_date > NOW() - interval '45 days'
       ) a ON true
      ORDER BY a.cnt DESC, c.sector_heat DESC
      LIMIT $1`,
    [limit],
  );
  return r.rows;
}

async function seedStarterWatchlist(userId) {
  const companies = await pickStarterCompanies(6);
  if (companies.length === 0) return;

  const signalsByCompany = await alerts.forCompanyIds(companies.map((c) => c.id));

  for (const c of companies) {
    const score = scoreCompany(c, { signals: signalsByCompany[c.id] || [] });
    await watchlist.add(userId, c.id, score.total);
  }

  // Seed a small live pipeline from the two strongest targets.
  if (companies[0]) await pipeline.addCompany(userId, companies[0].id, { stage: 'screening', next_step: 'Confirm valuation range' });
  if (companies[1]) await pipeline.addCompany(userId, companies[1].id, { stage: 'sourced', next_step: 'Build outreach angle' });

  // Default delivery: weekly briefing.
  await digests.upsert(userId, { frequency: 'weekly', hour_utc: 8, enabled: true });
}

module.exports = { seedStarterWatchlist };
