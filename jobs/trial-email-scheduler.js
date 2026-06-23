/**
 * Behavioral trial nurture scheduler.
 *
 * Replaces the old fixed-day cadence (days 1/7/13/15) with a behavior trigger:
 * once a trial user is ≥2 days in and still hasn't paid, send ONE tailored nudge —
 *   • activated (built a shortlist / generated a brief / worked the pipeline)
 *       → the upgrade case
 *   • dormant (hasn't engaged)
 *       → a sourced example brief built from their thesis, value up front
 *
 * Run via:        node jobs/trial-email-scheduler.js
 * Scheduled via:  polsia.toml [[crons]]  (daily)
 * Runtime guard:  POLSIA_IN_PROCESS_CRONS_ENABLED (set true to enable)
 * Dry run:        EMAIL_DRY_RUN=true logs instead of sending
 */
const { pool } = require('../db/index');
const {
  getBehavioralCandidates, markBehavioralSent,
  BEHAVIORAL_ACTIVATED, BEHAVIORAL_DORMANT,
} = require('../db/users');
const watchlist = require('../db/watchlist');
const theses = require('../db/theses');
const { buildShortlist } = require('../services/onboarding');
const { sendBehavioralEmail } = require('../services/email');

if (process.env.POLSIA_IN_PROCESS_CRONS_ENABLED !== 'true' && process.env.EMAIL_DRY_RUN !== 'true') {
  console.log('[trial-nurture] Disabled (POLSIA_IN_PROCESS_CRONS_ENABLED !== true)');
  process.exit(0);
}

async function dormantExample(userId) {
  const thesis = await theses.getForUser(userId);
  const shortlist = await buildShortlist(thesis || {}, 1);
  const c = shortlist[0];
  if (!c) return null;
  return {
    name: c.name, slug: c.slug, sector: c.sector, country: c.country,
    score: c.score.total, source: c.registry,
    reason: `${c.score.drivers[0]}${c.owner_age ? ` — owner ${c.owner_age}` : ''}${c.availability ? `, ${c.availability}` : ''}.`,
  };
}

async function main() {
  console.log('[trial-nurture] Starting behavioral nurture run');
  const candidates = await getBehavioralCandidates();
  let sent = 0, errors = 0;

  for (const user of candidates) {
    try {
      const activated = !!user.activated_at;
      const kind = activated ? 'activated' : 'dormant';
      const bit = activated ? BEHAVIORAL_ACTIVATED : BEHAVIORAL_DORMANT;

      const ctx = activated
        ? { shortlistCount: await watchlist.count(user.id) }
        : { example: await dormantExample(user.id) };

      const ok = await sendBehavioralEmail(user, kind, ctx);
      if (ok) { await markBehavioralSent(user.id, bit); sent++; }
      else errors++;
    } catch (err) {
      console.error(`[trial-nurture] Error for user ${user.id}:`, err.message);
      errors++;
    }
  }

  console.log(`[trial-nurture] Done. Candidates: ${candidates.length}, Sent: ${sent}, Errors: ${errors}`);
}

main()
  .then(() => pool.end())
  .catch((err) => { console.error('[trial-nurture] Fatal:', err.message); process.exit(1); });
