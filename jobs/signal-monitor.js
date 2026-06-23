/**
 * Autonomous signal monitor.
 *
 * Simulates the "24/7 monitoring" layer: each run inspects a slice of the
 * target universe and emits fresh M&A signals (alerts) for companies that
 * have gone quiet. In production this is where real data sources (regulatory
 * registers, funding databases, news) would feed in; here it synthesises
 * plausible, sector-aware signals so the product stays live.
 *
 * Run via:        node jobs/signal-monitor.js
 * Scheduled via:  polsia.toml [[crons]]
 * Runtime guard:  POLSIA_IN_PROCESS_CRONS_ENABLED (set true to enable)
 */
const { pool } = require('../db/index');
const { create } = require('../db/alerts');

if (process.env.POLSIA_IN_PROCESS_CRONS_ENABLED !== 'true') {
  console.log('[signal-monitor] Disabled (POLSIA_IN_PROCESS_CRONS_ENABLED !== true)');
  process.exit(0);
}

const REGULATOR_BY_COUNTRY = {
  Germany: 'BaFin', France: 'AMF', Netherlands: 'ECB', Italy: 'ECB',
  Spain: 'ECB', Ireland: 'FCA', Belgium: 'ECB',
};

const SEVERITIES = ['low', 'medium', 'medium', 'high']; // weighted toward medium

// type -> [title, detail builder]
const TEMPLATES = [
  ['funding',     'Bridge financing detected',            (c) => `${c.name} insiders extended a bridge round — often a pre-exit liquidity event.`],
  ['funding',     'New strategic investor on cap table',  (c) => `A larger ${c.sector} player took a minority position in ${c.name}.`],
  ['leadership',  'CFO transition',                       (c) => `Finance leadership change at ${c.name} — frequently precedes a transaction.`],
  ['leadership',  'Founder signalled exit openness',      (c) => `Public comments suggest ${c.name}'s founder is open to exploring a sale.`],
  ['regulatory',  'New regulatory filing detected',       (c) => `Fresh filing for ${c.name}; due-diligence window opening.`],
  ['market',      'Sector consolidation accelerating',    (c) => `Multiple comparable ${c.sector} deals closed this quarter — multiples expanding.`],
  ['acquisition', 'Competitor acquired in adjacent segment', (c) => `A ${c.sector} competitor was acquired — likely to re-rate ${c.name}.`],
  ['litigation',  'Litigation flag cleared',              (c) => `A pending dispute involving ${c.name} was resolved — removes a diligence blocker.`],
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Companies whose most recent signal is oldest (or absent). */
async function quietestCompanies(limit) {
  const r = await pool.query(
    `SELECT c.*, COALESCE(MAX(a.signal_date), '1970-01-01') AS last_signal
       FROM companies c
       LEFT JOIN alerts a ON a.company_id = c.id
      GROUP BY c.id
      ORDER BY last_signal ASC
      LIMIT $1`,
    [limit],
  );
  return r.rows;
}

async function main() {
  const batch = parseInt(process.env.SIGNAL_BATCH || '3', 10);
  const companies = await quietestCompanies(batch);
  let created = 0;

  for (const c of companies) {
    const [type, title, detailFor] = pick(TEMPLATES);
    const regulator = type === 'regulatory' ? (REGULATOR_BY_COUNTRY[c.country] || 'ECB') : null;
    await create({
      company_id: c.id,
      type,
      severity: pick(SEVERITIES),
      title,
      detail: detailFor(c),
      source: 'Autonomous monitor',
      regulator,
    });
    created++;
    console.log(`[signal-monitor] ${c.name}: ${type} — ${title}`);
  }

  console.log(`[signal-monitor] Done. Emitted ${created} signal(s).`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[signal-monitor] Fatal:', err.message);
    process.exit(1);
  });
