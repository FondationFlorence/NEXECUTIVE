/**
 * Daily trial email scheduler.
 *
 * Scans trial users and fires emails on the correct day:
 *   Day  1 → EMAIL_DAY1 bit set
 *   Day  7 → EMAIL_DAY7 bit set
 *   Day 13 → EMAIL_DAY13 bit set
 *   Day 15 → EMAIL_DAY15 bit set
 *
 * Run via: node jobs/trial-email-scheduler.js
 * Scheduled via: polsia.toml [[crons]]
 * Runtime guard: POLSIA_IN_PROCESS_CRONS_ENABLED (set false on Blaxel shadow)
 */
const {
  getUsersNeedingEmail,
  markEmailSent,
  EMAIL_DAY1,
  EMAIL_DAY7,
  EMAIL_DAY13,
  EMAIL_DAY15,
} = require('../db/users');
const { sendTrialEmail } = require('../services/email');

// Guard: disable in-process cron on Blaxel shadow
if (process.env.POLSIA_IN_PROCESS_CRONS_ENABLED !== 'true') {
  console.log('[trial-email-scheduler] Disabled (POLSIA_IN_PROCESS_CRONS_ENABLED !== true)');
  process.exit(0);
}

async function main() {
  console.log('[trial-email-scheduler] Starting daily trial email run');

  const now = new Date();
  let sent = 0, errors = 0;

  const dayConfigs = [
    { bit: EMAIL_DAY1,  daysAfter: 1  },
    { bit: EMAIL_DAY7,  daysAfter: 7  },
    { bit: EMAIL_DAY13, daysAfter: 13 },
    { bit: EMAIL_DAY15, daysAfter: 15 },
  ];

  for (const { bit, daysAfter } of dayConfigs) {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - daysAfter);
    // Reset time to start of day so we match users whose trial_start_date is on that day
    cutoff.setHours(0, 0, 0, 0);

    const cutoffEnd = new Date(cutoff);
    cutoffEnd.setDate(cutoffEnd.getDate() + 1);

    const users = await getUsersNeedingEmail(bit);

    // Filter to users whose trial_start_date falls within today's window for this email
    const eligible = users.filter(u => {
      const ts = new Date(u.trial_start_date);
      return ts >= cutoff && ts < cutoffEnd;
    });

    console.log(`[trial-email-scheduler] Day${daysAfter}: ${eligible.length} eligible users`);

    for (const user of eligible) {
      try {
        const ok = await sendTrialEmail(user, daysAfter);
        if (ok) {
          await markEmailSent(user.id, bit);
          sent++;
        } else {
          errors++;
        }
      } catch (err) {
        console.error(`[trial-email-scheduler] Error for user ${user.id}:`, err.message);
        errors++;
      }
    }
  }

  console.log(`[trial-email-scheduler] Done. Sent: ${sent}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error('[trial-email-scheduler] Fatal:', err);
  process.exit(1);
});