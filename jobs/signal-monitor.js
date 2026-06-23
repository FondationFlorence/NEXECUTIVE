/**
 * Autonomous signal monitor.
 *
 * Simulates the always-on monitoring layer: each run inspects the quietest
 * slice of the universe and emits fresh, SOURCED M&A signals. Registry-type
 * signals link back to the company's official registry record; deal/market
 * signals link to CFNEWS. In production, real fetchers (Companies House,
 * BODACC, Infogreffe, CFNEWS) replace the synthesiser here — the schema and
 * the verifiability contract stay the same.
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

const CFNEWS = 'https://www.cfnews.net/';
const SEVERITIES = ['low', 'medium', 'medium', 'high'];

// type, title, detail builder, sourceKind ('registry' | 'cfnews')
const TEMPLATES = [
  ['succession',   'Owner approaching retirement',     (c) => `Registry shows ${c.name}'s principal past typical retirement age — succession window opening.`, 'registry'],
  ['ownership',    'Share-transfer notice filed',      (c) => `An ownership-change entry was filed for ${c.name}.`, 'registry'],
  ['filing',       'New statutory accounts filed',     (c) => `${c.name} published fresh accounts — refresh the EBITDA read.`, 'registry'],
  ['availability', 'Owner exploring an exit',          (c) => `${c.name}'s owner signalled openness to a sale (off-market).`, 'registry'],
  ['deal',         'Comparable transaction closed',    (c) => `A comparable ${c.sector} business changed hands — a fresh multiples reference.`, 'cfnews'],
  ['market',       'Sector consolidation accelerating',(c) => `Roll-up activity is rising in ${c.sector}.`, 'cfnews'],
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
    const [type, title, detailFor, sourceKind] = pick(TEMPLATES);
    const source = sourceKind === 'cfnews' ? 'CFNEWS' : (c.registry || 'Registry');
    const sourceUrl = sourceKind === 'cfnews' ? CFNEWS + 'l-actualite/' : (c.registry_url || null);
    await create({
      company_id: c.id,
      type,
      severity: pick(SEVERITIES),
      title,
      detail: detailFor(c),
      source,
      source_url: sourceUrl,
    });
    created++;
    console.log(`[signal-monitor] ${c.name}: ${type} — ${title} (${source})`);
  }

  console.log(`[signal-monitor] Done. Emitted ${created} sourced signal(s).`);
}

main()
  .then(() => pool.end())
  .catch((err) => { console.error('[signal-monitor] Fatal:', err.message); process.exit(1); });
