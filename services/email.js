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
  const appUrl = 'https://nexecutive.polsia.app';
  const pricingUrl = 'https://nexecutive.polsia.app#pricing';

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
• Solo — €149/mo
• Team — €349/mo
• Enterprise — €799/mo

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

module.exports = { sendTrialEmail, TRIAL_EMAILS };