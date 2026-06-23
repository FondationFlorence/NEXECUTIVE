/**
 * Target Screening Engine.
 *
 * Produces an explainable 0-100 acquisition-fit score for a company from its
 * fundamentals plus recent signal momentum. Deterministic — the same inputs
 * always yield the same score, so the breakdown can be shown to the user.
 *
 *   scoreCompany(company, { signals }) -> {
 *     total, band, components: [{ key, label, score, max, note }], drivers
 *   }
 *
 * Component weights (sum = 100):
 *   strategicFit   25   sector consolidation heat
 *   growth         25   YoY growth rate
 *   sizeFit        20   mid-market sweet-spot on revenue
 *   ownership      15   how transactable the ownership structure is
 *   momentum       15   recent M&A signal activity
 */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round = (n) => Math.round(n);

const OWNERSHIP_SCORE = {
  'pe-backed': 15,     // sponsors run a clock — highly transactable
  'vc-backed': 13,     // venture timelines drive exits
  'family-owned': 12,  // succession events open windows
  'private': 9,
  'public': 4,         // hardest to acquire cleanly
};

const SEVERITY_WEIGHT = { high: 6, medium: 3, low: 1 };

function strategicFit(company) {
  const heat = clamp(company.sector_heat ?? 50, 0, 100);
  const score = round((heat / 100) * 25);
  return { key: 'strategicFit', label: 'Strategic fit / sector heat', score, max: 25,
    note: `Sector heat ${heat}/100` };
}

function growth(company) {
  const g = Number(company.growth_rate ?? 0);
  // 60%+ YoY maxes the component.
  const score = round(clamp(g / 60, 0, 1) * 25);
  return { key: 'growth', label: 'Growth trajectory', score, max: 25,
    note: g ? `${g}% YoY` : 'No growth data' };
}

function sizeFit(company) {
  const revenue = Number(company.revenue_eur ?? company.arr_eur ?? 0);
  const m = revenue / 1_000_000;
  // Mid-market M&A sweet spot ~ €20M–150M revenue. Triangular curve, with a
  // gentle penalty (not zero) outside the band.
  let factor;
  if (m <= 0) factor = 0;
  else if (m < 20) factor = 0.4 + 0.6 * (m / 20);          // ramp up to the band
  else if (m <= 150) factor = 1;                            // in the sweet spot
  else factor = clamp(1 - (m - 150) / 600, 0.35, 1);       // taper for large caps
  const score = round(factor * 20);
  return { key: 'sizeFit', label: 'Size fit (mid-market)', score, max: 20,
    note: m ? `~€${m.toFixed(0)}M revenue` : 'No revenue data' };
}

function ownership(company) {
  const own = (company.ownership || 'private').toLowerCase();
  const score = OWNERSHIP_SCORE[own] ?? 9;
  return { key: 'ownership', label: 'Transactability', score, max: 15,
    note: own.replace('-', ' ') };
}

function momentum(signals) {
  const now = Date.now();
  const recent = (signals || []).filter((s) => {
    const d = new Date(s.signal_date || s.created_at || now).getTime();
    return now - d <= 30 * 24 * 60 * 60 * 1000; // last 30 days
  });
  const raw = recent.reduce((sum, s) => sum + (SEVERITY_WEIGHT[s.severity] || 1), 0);
  const score = round(clamp(raw / 12, 0, 1) * 15); // ~2 high-severity signals maxes it
  const note = recent.length
    ? `${recent.length} signal${recent.length === 1 ? '' : 's'} in 30d`
    : 'Quiet';
  return { key: 'momentum', label: 'Signal momentum', score, max: 15, note };
}

function bandFor(total) {
  if (total >= 75) return 'Hot';
  if (total >= 55) return 'Warm';
  if (total >= 35) return 'Watch';
  return 'Cold';
}

function scoreCompany(company, { signals = [] } = {}) {
  const components = [
    strategicFit(company),
    growth(company),
    sizeFit(company),
    ownership(company),
    momentum(signals),
  ];
  const total = clamp(components.reduce((s, c) => s + c.score, 0), 0, 100);

  // Drivers = components contributing the most relative to their max.
  const drivers = [...components]
    .sort((a, b) => b.score / b.max - a.score / a.max)
    .slice(0, 2)
    .map((c) => c.label);

  return { total, band: bandFor(total), components, drivers };
}

module.exports = { scoreCompany, bandFor };
