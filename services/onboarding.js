/**
 * Thesis-driven onboarding (activation).
 *
 * The aha is immediate: the searcher gives us their thesis and we hand back a
 * ranked, sourced shortlist of matching targets — value before the trial clock
 * matters. seedFromThesis builds that shortlist into their workspace.
 */
const companies = require('../db/companies');
const alerts = require('../db/alerts');
const watchlist = require('../db/watchlist');
const pipeline = require('../db/pipeline');
const digests = require('../db/digests');
const { scoreCompany } = require('./scoring');
const { rankByThesis } = require('./thesis');

/** Score + thesis-rank the whole universe; return the strongest matches. */
async function buildShortlist(thesis, limit = 10) {
  const all = await companies.search({ limit: 500 });
  const ids = all.map((c) => c.id);
  const signalsByCompany = await alerts.forCompanyIds(ids);
  const scored = all.map((c) => {
    const signals = signalsByCompany[c.id] || [];
    return { ...c, signals, score: scoreCompany(c, { signals }) };
  });
  // Rank by thesis match, tie-break on intrinsic ripeness score.
  const ranked = rankByThesis(scored, thesis).sort(
    (a, b) => b.thesis.match - a.thesis.match || b.score.total - a.score.total,
  );
  return ranked.slice(0, limit);
}

/** Seed the user's workspace from their thesis: watchlist + a little pipeline. */
async function seedFromThesis(userId, thesis) {
  const shortlist = await buildShortlist(thesis, 10);
  if (shortlist.length === 0) return shortlist;

  for (const c of shortlist) {
    await watchlist.add(userId, c.id, c.score.total);
  }
  if (shortlist[0]) await pipeline.addCompany(userId, shortlist[0].id, { stage: 'screening', next_step: 'Confirm accounts + ownership' });
  if (shortlist[1]) await pipeline.addCompany(userId, shortlist[1].id, { stage: 'sourced', next_step: 'Draft owner approach' });
  await digests.upsert(userId, { frequency: 'weekly', hour_utc: 8, enabled: true });

  return shortlist;
}

module.exports = { buildShortlist, seedFromThesis };
