/**
 * Acquisition-fit scoring for the searcher / ETA buyer.
 *
 * Produces an explainable 0-100 "ripeness" score for a lower-mid-market
 * target from its fundamentals plus recent sourced signals. Deterministic —
 * same inputs always yield the same score, so the breakdown is shown to the
 * user and every point traces to a fact.
 *
 *   scoreCompany(company, { signals }) -> {
 *     total, band, components: [{ key, label, score, max, note }], drivers
 *   }
 *
 * Component weights (sum = 100), tuned for an individual acquirer buying ONE
 * business:
 *   succession    25   owner age + sale readiness — the searcher's #1 driver
 *   consolidation 20   sector roll-up heat (tailwind / exit competition)
 *   sizeFit       20   lower-mid-market sweet spot on revenue
 *   quality       15   EBITDA margin (cash quality of the business)
 *   momentum      20   recent, sourced signal activity
 */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round = (n) => Math.round(n);

const SEVERITY_WEIGHT = { high: 6, medium: 3, low: 1 };

const AVAIL_READINESS = {
  'for-sale': 1, exploring: 0.8, rumoured: 0.7, 'off-market': 0.5,
};

const AVAIL_LABEL_FR = {
  'for-sale': 'à vendre', exploring: 'en réflexion', rumoured: 'rumeur', 'off-market': 'hors-marché',
};

function succession(company) {
  const age = Number(company.owner_age || 0);
  const ageScore = age >= 68 ? 1 : age >= 64 ? 0.85 : age >= 60 ? 0.65 : age >= 56 ? 0.45 : age ? 0.3 : 0.4;
  const ready = AVAIL_READINESS[(company.availability || '').toLowerCase()] ?? 0.5;
  const factor = 0.6 * ageScore + 0.4 * ready;
  const score = round(factor * 25);
  const bits = [];
  if (age) bits.push(`propriétaire ${age} ans`);
  if (company.availability) bits.push(AVAIL_LABEL_FR[(company.availability || '').toLowerCase()] || company.availability);
  return { key: 'succession', label: 'Fenêtre de succession', score, max: 25,
    note: bits.join(' · ') || 'Aucune donnée dirigeant' };
}

function consolidation(company) {
  const heat = clamp(company.sector_heat ?? 50, 0, 100);
  return { key: 'consolidation', label: 'Chaleur de consolidation', score: round((heat / 100) * 20), max: 20,
    note: `Chaleur du secteur ${heat}/100` };
}

function sizeFit(company) {
  const m = Number(company.revenue_eur ?? 0) / 1_000_000;
  // Searcher sweet spot ~ €3M–20M revenue. Ramp in, plateau, taper for larger.
  let factor;
  if (m <= 0) factor = 0;
  else if (m < 3) factor = 0.45 + 0.55 * (m / 3);
  else if (m <= 20) factor = 1;
  else factor = clamp(1 - (m - 20) / 60, 0.3, 1);
  return { key: 'sizeFit', label: 'Adéquation de taille (lower-mid)', score: round(factor * 20), max: 20,
    note: m ? `~${m.toFixed(1).replace('.', ',')} M€ de CA` : 'Aucune donnée de CA' };
}

function quality(company) {
  const rev = Number(company.revenue_eur ?? 0);
  const ebitda = Number(company.ebitda_eur ?? 0);
  if (!rev || !ebitda) return { key: 'quality', label: 'Qualité du cash (marge EBITDA)', score: 7, max: 15, note: 'Aucune donnée de marge' };
  const margin = ebitda / rev; // 0..1
  const factor = clamp((margin - 0.08) / (0.20 - 0.08), 0, 1); // 8%→20% maps 0→1
  return { key: 'quality', label: 'Qualité du cash (marge EBITDA)', score: round(factor * 15), max: 15,
    note: `marge ${Math.round(margin * 100)} %` };
}

function momentum(signals) {
  const now = Date.now();
  const recent = (signals || []).filter((s) => {
    const d = new Date(s.signal_date || s.created_at || now).getTime();
    return now - d <= 45 * 24 * 60 * 60 * 1000;
  });
  const raw = recent.reduce((sum, s) => sum + (SEVERITY_WEIGHT[s.severity] || 1), 0);
  const score = round(clamp(raw / 10, 0, 1) * 20);
  return { key: 'momentum', label: 'Dynamique des signaux', score, max: 20,
    note: recent.length ? `${recent.length} signal${recent.length === 1 ? '' : 'aux'} sourcé${recent.length === 1 ? '' : 's'} · 45j` : 'Calme' };
}

function bandFor(total) {
  if (total >= 75) return 'Hot';
  if (total >= 55) return 'Warm';
  if (total >= 35) return 'Watch';
  return 'Cold';
}

function scoreCompany(company, { signals = [] } = {}) {
  const components = [
    succession(company),
    consolidation(company),
    sizeFit(company),
    quality(company),
    momentum(signals),
  ];
  const total = clamp(components.reduce((s, c) => s + c.score, 0), 0, 100);
  const drivers = [...components]
    .sort((a, b) => b.score / b.max - a.score / a.max)
    .slice(0, 2)
    .map((c) => c.label);
  return { total, band: bandFor(total), components, drivers };
}

module.exports = { scoreCompany, bandFor };
