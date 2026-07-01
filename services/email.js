/**
 * Email service — sends BildUp transactional emails via Postmark REST API.
 * API key stored in POSTMARK_API_KEY env var (injected by platform).
 * Stream: 'trial-email' for tracking, tagged per email number.
 * French-first copy (France-first audience).
 */
const https = require('https');
const fmt = require('../lib/format');

const POSTMARK_BASE = 'api.postmarkapp.com';
const FROM_EMAIL = 'hello@bildup.com';
const FROM_NAME = 'BildUp';

const TRIAL_EMAILS = {
  // body can include {{name}}, {{trial_end_date}}, {{app_url}}, {{pricing_url}}
  1: {
    subject: 'Bienvenue sur BildUp — par où commencer',
    stream: 'trial-welcome',
  },
  7: {
    subject: '7 jours après — ce que vous avez déjà trouvé',
    stream: 'trial-day7',
  },
  13: {
    subject: 'Votre essai BildUp se termine demain',
    stream: 'trial-day13',
  },
  15: {
    subject: 'Votre essai est terminé — une dernière chance',
    stream: 'trial-day15',
  },
};

function postmarkRequest(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: POSTMARK_BASE,
        path: '/email',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Accept': 'application/json',
          'X-Postmark-Account-Token': process.env.POSTMARK_API_KEY,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error(`Postmark parse error: ${data}`)); }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Build email body for a given day. */
function buildBody(day, user, trialEndDate) {
  const end = trialEndDate ? new Date(trialEndDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const appUrl = 'https://bildup.com';
  const pricingUrl = 'https://bildup.com#pricing';

  const vars = { name: user.name || '', trial_end_date: end, app_url: appUrl, pricing_url: pricingUrl };
  const hi = `Bonjour${vars.name ? ' ' + vars.name : ''},`;

  if (day === 1) {
    return `
${hi}

Votre essai BildUp de 14 jours est actif. Vous avez désormais un accès complet pour surveiller des cibles M&A et recevoir des briefings d'acquisition générés par IA — sans frais.

Commencez ici : lancez votre première recherche pour voir ce que BildUp fait remonter pour vous, dès maintenant.

Lancer ma première recherche → ${vars.app_url}

Votre essai court jusqu'au ${vars.trial_end_date}. Sans carte bancaire.
`.trim();
  }

  if (day === 7) {
    return `
${hi}

7 jours après — voici où vous en êtes.

BildUp surveille les signaux M&A sur votre liste de cibles. Si vous n'avez pas encore essayé, c'est le moment : les alertes se configurent en moins de 2 minutes et arrivent directement dans votre boîte mail.

Il vous reste 7 jours d'essai. Ensuite, vos données et alertes sont conservées mais l'accès s'arrête.

Débloquez les alertes illimitées — choisissez votre offre → ${vars.pricing_url}
`.trim();
  }

  if (day === 13) {
    return `
${hi}

Votre essai BildUp se termine demain.

Vos données, alertes et historique de recherche sont conservés — mais l'accès s'arrête sauf si vous vous abonnez. Aucune carte ne sera débitée automatiquement.

Choisissez votre offre :
• Searcher — 299 €/mois
• Sponsor — 999 €/mois
• Firm — dès 1 800 €/mois (accompagné)

S'abonner maintenant → ${vars.pricing_url}

Besoin de plus de temps ? Répondez à cet e-mail — nous le prolongerons.
`.trim();
  }

  if (day === 15) {
    return `
${hi}

Votre essai BildUp est terminé.

Vous pouvez revenir à tout moment — vos données et alertes sont toujours là quand vous serez prêt.

S'abonner → ${vars.pricing_url}

Nous ne vous écrirons plus au sujet de cet essai. Si vous voulez réessayer plus tard, vous serez toujours le bienvenu.
`.trim();
  }

  return '';
}

/** Send trial email N to a user. Returns true on success. */
async function sendTrialEmail(user, dayNum) {
  const config = TRIAL_EMAILS[dayNum];
  if (!config) throw new Error(`No email config for day ${dayNum}`);

  // Calculate trial end date
  const trialEnd = user.trial_start_date
    ? new Date(new Date(user.trial_start_date).getTime() + 14 * 24 * 60 * 60 * 1000)
    : null;

  const body = buildBody(dayNum, user, trialEnd);

  try {
    const result = await postmarkRequest({
      From: `${FROM_NAME} <${FROM_EMAIL}>`,
      To: user.email,
      Subject: config.subject,
      HtmlBody: body.replace(/\n/g, '<br>'),
      TextBody: body,
      TrackOpens: true,
      MessageStream: config.stream,
      Metadata: { user_id: String(user.id), email_day: String(dayNum) },
    });

    if (result.ErrorCode !== 0) {
      console.error(`[email] Postmark error for ${user.email} day${dayNum}: ${result.Message}`);
      return false;
    }

    console.log(`[email] Sent day${dayNum} to ${user.email} (MessageID: ${result.MessageID})`);
    return true;
  } catch (err) {
    console.error(`[email] Failed to send day${dayNum} to ${user.email}:`, err.message);
    return false;
  }
}

// --- Behavioral nurture ----------------------------------------------------
// Replaces the fixed-day cadence: branch on what the user actually did.

const APP_URL = 'https://bildup.com';
const PRICING_URL = 'https://bildup.com#pricing';

const BEHAVIORAL = {
  activated: { subject: 'Vous avez trouvé des cibles actives — voici pourquoi continuer', stream: 'nurture-activated' },
  dormant:   { subject: 'Une cible qui correspond à votre thèse', stream: 'nurture-dormant' },
};

function buildBehavioralBody(kind, user, ctx = {}) {
  const hi = `Bonjour${user.name ? ' ' + user.name : ''},`;
  if (kind === 'activated') {
    return `
${hi}

Vous avez ajouté ${ctx.shortlistCount || 'plusieurs'} cibles à votre shortlist et commencé à les travailler — c'est exactement l'objectif.

Voici pourquoi continuer : un seul lead propriétaire et sourcé qui aboutit vaut bien plus que l'abonnement. BildUp continue de surveiller chaque cible de votre liste et signale le prochain signal de cession, de succession ou d'opération dès qu'il est déposé — chacun relié à sa source primaire pour que vous agissiez avec conviction.

Sécurisez votre accès avant la fin de l'essai → ${PRICING_URL}

Répondez si vous voulez un coup de main pour affiner votre thèse.
`.trim();
  }
  // dormant
  const ex = ctx.example;
  const exampleBlock = ex
    ? `D'après votre thèse, en voici une qui sort du lot :

• ${ex.name} — ${ex.sector}, ${fmt.country(ex.country)}
  ${ex.reason}
  Score de fit ${ex.score}/100. Chaque signal remonte à ${ex.source || 'un registre officiel'}.

Voir le brief sourcé complet → ${APP_URL}/company/${ex.slug}`
    : `Donnez-nous votre thèse et nous vous montrons des cibles correspondantes instantanément — chacune reliée à une source officielle.

Construisez votre shortlist → ${APP_URL}/onboarding`;

  return `
${hi}

Vous n'avez pas encore lancé votre thèse — alors voici la valeur d'emblée, sans effort.

${exampleBlock}

C'est toute l'idée : vous nous donnez le mandat, nous faisons remonter des cibles que vous pouvez vérifier. Des entreprises hors-marché avec de vrais signaux de succession, pas des annonces d'intermédiaires recyclées.

${ex ? 'Construisez votre shortlist complète → ' + APP_URL + '/onboarding' : ''}
`.trim();
}

/** Send a behavioral nurture email. Returns true on success (or in dry-run). */
async function sendBehavioralEmail(user, kind, ctx = {}) {
  const config = BEHAVIORAL[kind];
  if (!config) throw new Error(`No behavioral config for ${kind}`);
  const body = buildBehavioralBody(kind, user, ctx);

  if (process.env.EMAIL_DRY_RUN === 'true' || !process.env.POSTMARK_API_KEY) {
    console.log(`[email] DRY-RUN ${kind} -> ${user.email}\n${body}\n`);
    return true;
  }

  try {
    const result = await postmarkRequest({
      From: `${FROM_NAME} <${FROM_EMAIL}>`,
      To: user.email,
      Subject: config.subject,
      HtmlBody: body.replace(/\n/g, '<br>'),
      TextBody: body,
      TrackOpens: true,
      MessageStream: config.stream,
      Metadata: { user_id: String(user.id), nurture: kind },
    });
    if (result.ErrorCode !== 0) {
      console.error(`[email] Postmark error for ${user.email} ${kind}: ${result.Message}`);
      return false;
    }
    console.log(`[email] Sent ${kind} to ${user.email} (MessageID: ${result.MessageID})`);
    return true;
  } catch (err) {
    console.error(`[email] Failed to send ${kind} to ${user.email}:`, err.message);
    return false;
  }
}

module.exports = { sendTrialEmail, TRIAL_EMAILS, sendBehavioralEmail, buildBehavioralBody };
