/**
 * Deal Brief Agent.
 *
 * Generates an executive-ready acquisition brief for a searcher. The core
 * promise is verifiability: every signal carries its primary source, and the
 * brief ends with a Sources section linking each claim to an official document
 * (registry filing, BODACC notice, CFNEWS article…).
 *
 * Uses OpenAI when OPENAI_API_KEY is configured; otherwise a deterministic
 * template so the feature works in every environment. French-first output.
 *
 *   generateBrief(company, signals, score) -> { content, model }
 */
const { scoreCompany } = require('./scoring');
const fmt = require('../lib/format');

const MODEL = process.env.OPENAI_BRIEF_MODEL || 'gpt-4o-mini';

const eur = fmt.eur;

function factSheet(company) {
  return [
    `Nom : ${company.name}`,
    `Secteur : ${company.sector}`,
    `Siège : ${[company.hq_city, fmt.country(company.country)].filter(Boolean).join(', ')}`,
    `Registre : ${company.registry || '—'}${company.registry_url ? ` (${company.registry_url})` : ''}`,
    `Création : ${company.founded_year || '—'}`,
    `Effectif : ${company.employees ?? '—'}`,
    `CA : ${eur(company.revenue_eur)}`,
    company.ebitda_eur ? `EBITDA : ${eur(company.ebitda_eur)}` : null,
    `Âge du dirigeant : ${company.owner_age || '—'}`,
    `Disponibilité : ${fmt.availability(company.availability) || '—'}`,
    `Détention : ${fmt.ownership(company.ownership) || '—'}`,
    `Valorisation indicative : ${eur(company.valuation_eur)}`,
    `Description : ${company.description || '—'}`,
  ].filter(Boolean).join('\n');
}

function signalLines(signals) {
  if (!signals || signals.length === 0) return 'Aucun signal actif dans la fenêtre de veille.';
  return signals.slice(0, 8).map((s) => {
    const when = new Date(s.signal_date || s.created_at).toISOString().slice(0, 10);
    const src = s.source_url ? ` ([${s.source || 'source'}](${s.source_url}))` : s.source ? ` (${s.source})` : '';
    return `- (${when}, ${fmt.severity(s.severity)}/${fmt.alertType(s.type)}) ${s.title}${s.detail ? ' — ' + s.detail : ''}${src}`;
  }).join('\n');
}

function sourcesBlock(company, signals) {
  const lines = [];
  if (company.registry_url) lines.push(`- Fiche entreprise — [${company.registry || 'Registre'}](${company.registry_url})`);
  for (const s of signals || []) {
    if (s.source_url) lines.push(`- ${s.title} — [${s.source || 'source'}](${s.source_url})`);
  }
  return lines.length ? lines.join('\n') : '- Aucun lien source disponible pour cette cible pour l’instant.';
}

function contactLines(contacts) {
  if (!contacts || contacts.length === 0) return 'Aucun contact identifié pour l’instant — enrichissement en attente.';
  return contacts.slice(0, 6).map((c) => {
    const bits = [`**${c.name}**${c.role ? ' — ' + c.role : ''}`];
    if (c.email) bits.push(`e-mail : ${c.email}`);
    if (c.personal_email) bits.push(`perso : ${c.personal_email}`);
    if (c.phone) bits.push(`tél. : ${c.phone}`);
    if (c.linkedin_url) bits.push(`[LinkedIn](${c.linkedin_url})`);
    const conf = c.confidence ? ` _(source : ${c.source || 'registre'}, ${c.confidence})_` : '';
    return `- ${bits.join(' · ')}${conf}`;
  }).join('\n');
}

/** Deterministic template brief — no external calls. */
function templateBrief(company, signals, score, contacts) {
  const s = score || scoreCompany(company, { signals });
  const margin = company.ebitda_eur && company.revenue_eur
    ? Math.round((company.ebitda_eur / company.revenue_eur) * 100) : null;
  const revM = Number(company.revenue_eur || 0) / 1e6;

  const nextMove = s.total >= 75
    ? 'Engagez maintenant — la fenêtre succession/disponibilité est ouverte et le score est élevé. Préparez une approche directe, de dirigeant à dirigeant.'
    : s.total >= 55
      ? 'Ajoutez à la shortlist active et placez un déclencheur sur le prochain signal de cession ou de dépôt avant d’approcher.'
      : 'Continuez la veille ; revenez quand un signal de succession, de disponibilité ou d’opération se déclenche.';

  return `# Brief d’acquisition — ${company.name}

**Score de fit : ${s.total}/100 (${fmt.band(s.band)})** · Principaux moteurs : ${s.drivers.join(', ')}

## Aperçu
${company.name} est une entreprise du secteur ${company.sector} à ${[company.hq_city, fmt.country(company.country)].filter(Boolean).join(', ')}, créée en ${company.founded_year || 'n.c.'}, ~${company.employees ?? 'n.c.'} salariés. CA ${eur(company.revenue_eur)}${company.ebitda_eur ? `, EBITDA ${eur(company.ebitda_eur)}${margin != null ? ` (marge ${margin} %)` : ''}` : ''}. ${company.ownership ? fmt.ownership(company.ownership) : 'Détention privée'}, valorisation indicative ${eur(company.valuation_eur)}.

## Pourquoi c’est mûr maintenant
- Dirigeant ${company.owner_age ? `âgé de ${company.owner_age} ans` : 'âge non communiqué'}, statut **${fmt.availability(company.availability) || 'inconnu'}** — ${company.owner_age >= 62 ? 'fenêtre de succession crédible' : 'à surveiller pour un déclencheur de succession'}.
- Chaleur du secteur ${company.sector_heat ?? 'n.c.'}/100 — ${company.sector_heat >= 75 ? 'build-up actif ; agissez avant les consolidateurs' : company.sector_heat >= 55 ? 'en réchauffement ; concurrence sélective' : 'calme ; origination hors-marché'}.
- Taille ${revM <= 20 && revM >= 3 ? 'dans' : 'hors de'} la zone idéale du lower-mid-market.

## Piste des signaux (sourcés)
${signalLines(signals)}

## À vérifier ensuite
- Récupérer les derniers comptes annuels au registre et confirmer la marge EBITDA.
- Confirmer la structure de détention (bénéficiaires effectifs) et d’éventuels nantissements inscrits.
- Valider directement le signal de disponibilité avant d’engager du temps de due diligence.

## Contacts clés
${contactLines(contacts)}

## Prochaine action recommandée
${nextMove}

## Sources
${sourcesBlock(company, signals)}

_Généré par Bildup — moteur de gabarit. Chaque affirmation ci-dessus renvoie à une source primaire. Configurez OPENAI_API_KEY pour des briefs narratifs._`;
}

/** OpenAI-backed narrative brief. Throws on any API/SDK error. */
async function openaiBrief(company, signals, score, contacts) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const s = score || scoreCompany(company, { signals });

  const system =
    'Tu es analyste senior dans un search fund / un repreneur ETA. Rédige en FRANÇAIS des ' +
    'briefs d’acquisition concis et prêts à présenter, au format Markdown, pour un acheteur ' +
    'individuel qui rachète UNE entreprise du lower-mid-market. Sois précis et quantitatif. ' +
    'N’invente JAMAIS de chiffres ni de coordonnées au-delà des données fournies. Chaque ' +
    'affirmation factuelle doit être traçable à une source fournie. Utilise ces sections : ' +
    'Aperçu, Pourquoi c’est mûr maintenant, Piste des signaux (sourcés), Contacts clés, ' +
    'À vérifier ensuite, Prochaine action recommandée, Sources. Dans Contacts clés, liste chaque ' +
    'personne nommée avec son rôle, e-mail, e-mail perso et LinkedIn exactement comme fournis ' +
    '(sans rien fabriquer). Dans Sources, liste chaque signal sous forme de lien Markdown vers son URL source.';

  const user =
    `Rédige un brief d’acquisition pour cette cible.\n\n` +
    `SCORE DE FIT : ${s.total}/100 (${fmt.band(s.band)}) ; principaux moteurs : ${s.drivers.join(', ')}\n\n` +
    `FONDAMENTAUX :\n${factSheet(company)}\n\n` +
    `SIGNAUX SOURCÉS :\n${signalLines(signals)}\n\n` +
    `CONTACTS CLÉS :\n${contactLines(contacts)}\n`;

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
