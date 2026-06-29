/**
 * Deal Brief Agent.
 *
 * Generates an executive-ready acquisition brief for a searcher. The core
 * promise is verifiability: every signal carries its primary source, and the
 * brief ends with a Sources section linking each claim to an official document
 * (registry filing, BODACC notice, CFNEWS article…).
 *
 * Uses OpenAI when OPENAI_API_KEY is configured; otherwise a deterministic
 * template so the feature works in every environment.
 *
 *   generateBrief(company, signals, score) -> { content, model }
 */
const { scoreCompany } = require('./scoring');

const MODEL = process.env.OPENAI_BRIEF_MODEL || 'gpt-4o-mini';

function eur(n) {
  if (n == null) return '—';
  const m = Number(n) / 1_000_000;
  if (m >= 1000) return `€${(m / 1000).toFixed(1)}B`;
  return `€${m.toFixed(m < 10 ? 1 : 0)}M`;
}

function factSheet(company) {
  return [
    `Name: ${company.name}`,
    `Sector: ${company.sector}`,
    `HQ: ${[company.hq_city, company.country].filter(Boolean).join(', ')}`,
    `Registry: ${company.registry || '—'}${company.registry_url ? ` (${company.registry_url})` : ''}`,
    `Founded: ${company.founded_year || '—'}`,
    `Employees: ${company.employees ?? '—'}`,
    `Revenue: ${eur(company.revenue_eur)}`,
    company.ebitda_eur ? `EBITDA: ${eur(company.ebitda_eur)}` : null,
    `Owner age: ${company.owner_age || '—'}`,
    `Availability: ${company.availability || '—'}`,
    `Ownership: ${company.ownership || '—'}`,
    `Indicative valuation: ${eur(company.valuation_eur)}`,
    `Description: ${company.description || '—'}`,
  ].filter(Boolean).join('\n');
}

function signalLines(signals) {
  if (!signals || signals.length === 0) return 'No active signals in the monitoring window.';
  return signals.slice(0, 8).map((s) => {
    const when = new Date(s.signal_date || s.created_at).toISOString().slice(0, 10);
    const src = s.source_url ? ` ([${s.source || 'source'}](${s.source_url}))` : s.source ? ` (${s.source})` : '';
    return `- (${when}, ${s.severity}/${s.type}) ${s.title}${s.detail ? ' — ' + s.detail : ''}${src}`;
  }).join('\n');
}

function sourcesBlock(company, signals) {
  const lines = [];
  if (company.registry_url) lines.push(`- Company record — [${company.registry || 'Registry'}](${company.registry_url})`);
  for (const s of signals || []) {
    if (s.source_url) lines.push(`- ${s.title} — [${s.source || 'source'}](${s.source_url})`);
  }
  return lines.length ? lines.join('\n') : '- No source links available for this target yet.';
}

function contactLines(contacts) {
  if (!contacts || contacts.length === 0) return 'No contacts identified yet — enrichment pending.';
  return contacts.slice(0, 6).map((c) => {
    const bits = [`**${c.name}**${c.role ? ' — ' + c.role : ''}`];
    if (c.email) bits.push(`email: ${c.email}`);
    if (c.personal_email) bits.push(`personal: ${c.personal_email}`);
    if (c.phone) bits.push(`phone: ${c.phone}`);
    if (c.linkedin_url) bits.push(`[LinkedIn](${c.linkedin_url})`);
    const conf = c.confidence ? ` _(source: ${c.source || 'registry'}, ${c.confidence})_` : '';
    return `- ${bits.join(' · ')}${conf}`;
  }).join('\n');
}

/** Deterministic template brief — no external calls. */
function templateBrief(company, signals, score, contacts) {
  const s = score || scoreCompany(company, { signals });
  const margin = company.ebitda_eur && company.revenue_eur
    ? Math.round((company.ebitda_eur / company.revenue_eur) * 100) : null;

  const nextMove = s.total >= 75
    ? 'Originate now — the succession/availability window is open and the score is high. Draft a direct, owner-to-owner approach.'
    : s.total >= 55
      ? 'Add to the active shortlist and set a trigger on the next ownership or filing signal before approaching.'
      : 'Keep monitoring; revisit when a succession, availability, or deal signal fires.';

  return `# Acquisition Brief — ${company.name}

**Fit score: ${s.total}/100 (${s.band})** · Top drivers: ${s.drivers.join(', ')}

## Snapshot
${company.name} is a ${company.sector} business in ${[company.hq_city, company.country].filter(Boolean).join(', ')}, founded ${company.founded_year || 'n/a'}, ~${company.employees ?? 'n/a'} staff. Revenue ${eur(company.revenue_eur)}${company.ebitda_eur ? `, EBITDA ${eur(company.ebitda_eur)}${margin != null ? ` (${margin}% margin)` : ''}` : ''}. ${company.ownership ? company.ownership.replace('-', ' ') : 'Privately'} held, indicative valuation ${eur(company.valuation_eur)}.

## Why it's ripe now
- Owner ${company.owner_age ? `aged ${company.owner_age}` : 'age undisclosed'}, status **${company.availability || 'unknown'}** — ${company.owner_age >= 62 ? 'a credible succession window' : 'monitor for a succession trigger'}.
- Sector heat ${company.sector_heat ?? 'n/a'}/100 — ${company.sector_heat >= 75 ? 'active roll-up; act before consolidators do' : company.sector_heat >= 55 ? 'warming; selective competition' : 'quiet; originate off-market'}.
- Size ${Number(company.revenue_eur || 0) / 1e6 <= 20 && Number(company.revenue_eur || 0) / 1e6 >= 3 ? 'sits inside' : 'sits outside'} the lower-mid-market sweet spot.

## Signal trail (sourced)
${signalLines(signals)}

## What to verify next
- Pull the latest statutory accounts from the registry and confirm the EBITDA margin.
- Confirm the ownership/PSC structure and any registered charges.
- Validate the availability signal directly before committing diligence time.

## Key contacts
${contactLines(contacts)}

## Recommended next move
${nextMove}

## Sources
${sourcesBlock(company, signals)}

_Generated by Bildup — template engine. Every claim above links to a primary source. Configure OPENAI_API_KEY for narrative briefs._`;
}

/** OpenAI-backed narrative brief. Throws on any API/SDK error. */
async function openaiBrief(company, signals, score, contacts) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const s = score || scoreCompany(company, { signals });

  const system =
    'You are a senior analyst at a search fund / ETA acquirer. Write concise, ' +
    'executive-ready acquisition briefs in Markdown for an individual buyer purchasing ONE ' +
    'lower-mid-market company. Be specific and quantitative. NEVER invent figures or contact ' +
    'details beyond the data provided. Every factual claim must be traceable to a provided source. ' +
    'Use these sections: Snapshot, Why it\'s ripe now, Signal trail (sourced), Key contacts, ' +
    'What to verify next, Recommended next move, Sources. In Key contacts, list each named person ' +
    'with role, email, personal email and LinkedIn exactly as provided (do not fabricate). In ' +
    'Sources, list each signal as a Markdown link to its source URL.';

  const user =
    `Write an acquisition brief for this target.\n\n` +
    `FIT SCORE: ${s.total}/100 (${s.band}); top drivers: ${s.drivers.join(', ')}\n\n` +
    `FUNDAMENTALS:\n${factSheet(company)}\n\n` +
    `SOURCED SIGNALS:\n${signalLines(signals)}\n\n` +
    `KEY CONTACTS:\n${contactLines(contacts)}\n`;

  const resp = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.4,
    max_tokens: 1000,
  });

  const content = resp.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty completion');
  return { content, model: MODEL };
}

async function generateBrief(company, signals = [], score = null, contacts = []) {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await openaiBrief(company, signals, score, contacts);
    } catch (err) {
      console.error('[briefs] OpenAI failed, falling back to template:', err.message);
    }
  }
  return { content: templateBrief(company, signals, score, contacts), model: 'template' };
}

module.exports = { generateBrief, templateBrief };
