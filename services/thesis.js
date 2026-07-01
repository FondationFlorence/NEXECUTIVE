/**
 * Acquisition thesis matching — powers the instant shortlist (activation).
 *
 * A thesis is what the searcher is hunting for: sectors, countries, and a
 * revenue band (plus free-text keywords). matchThesis scores how well a
 * company fits *that buyer's* mandate (distinct from scoring.js, which scores
 * how ripe/acquirable the company is in general).
 *
 *   matchThesis(company, thesis) -> { match: 0-100, reasons: [...] }
 *   rankByThesis(companies, thesis) -> companies sorted by match desc
 */
const inList = (val, list) => Array.isArray(list) && list.length > 0 && list.includes(val);

function matchThesis(company, thesis) {
  if (!thesis) return { match: 50, reasons: [] };
  const reasons = [];
  let score = 0;
  let weight = 0;

  // Sector (weight 40)
  weight += 40;
  if (!thesis.sectors || thesis.sectors.length === 0) score += 40;
  else if (inList(company.sector, thesis.sectors)) { score += 40; reasons.push(`Sector: ${company.sector}`); }
  else score += 6; // off-thesis sector still gets a little credit

  // Country (weight 25)
  weight += 25;
  if (!thesis.countries || thesis.countries.length === 0) score += 25;
  else if (inList(company.country, thesis.countries)) { score += 25; reasons.push(`Geography: ${company.country}`); }
  else score += 4;

  // Revenue band (weight 25)
  weight += 25;
  const rev = Number(company.revenue_eur ?? 0);
  const min = thesis.rev_min != null ? Number(thesis.rev_min) : null;
  const max = thesis.rev_max != null ? Number(thesis.rev_max) : null;
  if (min == null && max == null) score += 25;
  else {
    const okMin = min == null || rev >= min;
    const okMax = max == null || rev <= max;
    if (okMin && okMax) { score += 25; reasons.push('In your size range'); }
    else score += 8; // near-miss
  }

  // Keywords (weight 10)
  weight += 10;
  const kw = (thesis.keywords || '').toLowerCase().split(/[\s,]+/).filter((t) => t.length > 2);
  if (kw.length === 0) score += 10;
  else {
    const hay = `${company.name} ${company.sector} ${company.description || ''}`.toLowerCase();
    const hit = kw.find((t) => hay.includes(t));
    if (hit) { score += 10; reasons.push(`Matches “${hit}”`); }
    else score += 2;
  }

  return { match: Math.round((score / weight) * 100), reasons };
}

function rankByThesis(companies, thesis) {
  return companies
    .map((c) => ({ ...c, thesis: matchThesis(c, thesis) }))
    .sort((a, b) => b.thesis.match - a.thesis.match);
}

/** Normalize a posted thesis form into the stored shape. */
function normalizeThesisForm(body = {}) {
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
  const toEur = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? null : Math.round(n * 1_000_000);
  };
  return {
    sectors: arr(body.sectors),
    countries: arr(body.countries),
    rev_min: toEur(body.rev_min),
    rev_max: toEur(body.rev_max),
    keywords: (body.keywords || '').toString().slice(0, 500),
  };
}

module.exports = { matchThesis, rankByThesis, normalizeThesisForm };
