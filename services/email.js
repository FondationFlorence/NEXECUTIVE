/**
 * Email service — sends Nexecutive transactional emails via Postmark REST API.
 * API key stored in POSTMARK_API_KEY env var (injected by platform).
 * Stream: 'trial-email' for tracking, tagged per email number.
 */
const https = require('https');

const POSTMARK_BASE = 'api.postmarkapp.com';
const FROM_EMAIL = 'hello@nexecutive.com';
const FROM_NAME = 'Nexecutive';

const TRIAL_EMAILS = {
  // body can include {{name}}, {{trial_end_date}}, {{app_url}}, {{pricing_url}}
  1: {
    subject: 'Welcome to Nexecutive — here’s what to do first',
    stream: 'trial-welcome',
  },
  7: {
    subject: '7 days in — what you’ve found so far',
    stream: 'trial-day7',
  },
  13: {
    subject: 'Your Nexecutive trial ends tomorrow',
    stream: 'trial-day13',
  },
  15: {
    subject: 'Your trial has ended — one last chance',
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
  const end = trialEndDate ? new Date(trialEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const appUrl = 'https://nexecutive.com';
  const pricingUrl = 'https://nexecutive.com#pricing';

  const vars = { name: user.name || '', trial_end_date: end, app_url: appUrl, pricing_url: pricingUrl };

  if (day === 1) {
    return `
Hi${vars.name ? ' ' + vars.name : ''},

Your 14-day Nexecutive trial is live. You now have full access to monitor M&A targets and receive AI-generated deal briefings — at no cost.

Start here: run your first search to see what Nexecutive surfaces for you right now.

Run your first search → ${vars.app_url}

Your trial runs until ${vars.trial_end_date}. No credit card needed.
`.trim();
  }

  if (day === 7) {
    return `
Hi${vars.name ? ' ' + vars.name : ''},

7 days in — here's where you stand.

Nexecutive has been monitoring M&A signals across your target list. If you haven't tried it yet, now's the moment: alerts can be set up in under 2 minutes and deliver straight to your inbox.

7 days left in your trial. After that, your data and alerts are saved but access stops.

Unlock unlimited alerts — choose your plan → ${vars.pricing_url}
`.trim();
  }

  if (day === 13) {
    return `
Hi${vars.name ? ' ' + vars.name : ''},

Your Nexecutive trial ends tomorrow.

Your data, alerts, and search history are saved — but access stops unless you subscribe. No credit card will be charged automatically.

Choose your plan:
• Searcher — €299/mo
• Sponsor — €999/mo
• Firm — from €1,800/mo (sales-assisted)

Subscribe now → ${vars.pricing_url}

Need more time? Reply to this email — we'll extend it.
`.trim();
  }

  if (day === 15) {
    return `
Hi${vars.name ? ' ' + vars.name : ''},

Your Nexecutive trial has ended.

You can rejoin anytime — your data and alerts are still here when you're ready.

Subscribe → ${vars.pricing_url}

We won't email you again about this trial. If you want to try again later, you're always welcome back.
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

const APP_URL = 'https://nexecutive.com';
const PRICING_URL = 'https://nexecutive.com#pricing';

const BEHAVIORAL = {
  activated: { subject: 'You found live targets — here’s the case to keep going', stream: 'nurture-activated' },
  dormant:   { subject: 'A target we think fits your thesis', stream: 'nurture-dormant' },
};

function buildBehavioralBody(kind, user, ctx = {}) {
  const hi = `Hi${user.name ? ' ' + user.name : ''},`;
  if (kind === 'activated') {
    return `
${hi}

You've put ${ctx.shortlistCount || 'several'} targets on your shortlist and started working them — that's exactly the point.

Here's the case to keep going: a single proprietary, sourced lead that closes is worth orders of magnitude more than the subscription. Nexecutive keeps monitoring every target on your list and flags the next ownership, succession, or deal signal the moment it's filed — each one linked to the primary source so you can act with conviction.

Lock in your access before the trial ends → ${PRICING_URL}

Reply if you want a hand sharpening your thesis.
`.trim();
  }
  // dormant
  const ex = ctx.example;
  const exampleBlock = ex
    ? `Based on your thesis, here's one that stands out:

• ${ex.name} — ${ex.sector}, ${ex.country}
  ${ex.reason}
  Fit score ${ex.score}/100. Every signal traces to ${ex.source || 'an official registry'}.

See the full sourced brief → ${APP_URL}/company/${ex.slug}`
    : `Tell us your thesis and we'll show you matching targets instantly — each traced to an official source.

Build your shortlist → ${APP_URL}/onboarding`;

  return `
${hi}

You haven't run your thesis yet — so here's the value up front, no work required.

${exampleBlock}

That's the whole idea: you give us the mandate, we surface targets you can verify. Off-market businesses with real succession signals, not recycled broker listings.

${ex ? 'Build your full shortlist → ' + APP_URL + '/onboarding' : ''}
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