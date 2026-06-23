/**
 * Trial email management routes.
 * - POST /api/trial-emails/register  → start trial for a user (webhook from signup)
 * - POST /api/trial-emails/pause    → pause sequence when user subscribes
 * - GET  /api/trial-emails/trigger  → manual trigger for testing (dev only)
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../db/index');
const { createTrialUser, getUsersNeedingEmail, markEmailSent, EMAIL_DAY1, EMAIL_DAY7, EMAIL_DAY13, EMAIL_DAY15 } = require('../db/users');
const { sendTrialEmail } = require('../services/email');

// Register a new trial user (called by signup flow)
router.post('/register', express.json(), async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const trialStartDate = new Date();
  try {
    const user = await createTrialUser({ email, name, trialStartDate });
    res.json({ ok: true, userId: user.id, trialStartDate });
  } catch (err) {
    console.error('[trial-emails] register error:', err.message);
    res.status(500).json({ error: 'Failed to register trial' });
  }
});

// Pause email sequence (called when user upgrades to paid)
router.post('/pause', express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  // Stop all nurture — both the legacy day bits and the behavioral branches.
  await pool.query(
    `UPDATE users SET email_sequence_sent = 15, behavioral_email_sent = 3 WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  res.json({ ok: true });
});

// Manual trigger for testing — fires emails for a specific day
router.get('/trigger', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Disabled in production' });
  }
  const day = parseInt(req.query.day || '1', 10);
  if (![1, 7, 13, 15].includes(day)) return res.status(400).json({ error: 'day must be 1, 7, 13, or 15' });

  const bitMap = { 1: EMAIL_DAY1, 7: EMAIL_DAY7, 13: EMAIL_DAY13, 15: EMAIL_DAY15 };
  const bit = bitMap[day];

  const users = await getUsersNeedingEmail(bit);
  const eligible = users.filter(u => {
    const ts = new Date(u.trial_start_date);
    const now = new Date();
    const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - day); cutoff.setHours(0,0,0,0);
    const cutoffEnd = new Date(cutoff); cutoffEnd.setDate(cutoffEnd.getDate() + 1);
    return ts >= cutoff && ts < cutoffEnd;
  });

  let sent = 0;
  for (const user of eligible) {
    const ok = await sendTrialEmail(user, day);
    if (ok) { await markEmailSent(user.id, bit); sent++; }
  }

  res.json({ day, eligible: eligible.length, sent });
});

// Get trial user info
router.get('/status/:email', async (req, res) => {
  const r = await pool.query(
    `SELECT id, email, name, trial_start_date, email_sequence_sent, subscription_status FROM users WHERE LOWER(email) = LOWER($1)`,
    [req.params.email],
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
  const u = r.rows[0];
  const mask = u.email_sequence_sent || 0;
  res.json({
    email: u.email,
    name: u.name,
    trial_start_date: u.trial_start_date,
    subscription_status: u.subscription_status,
    emails_sent: {
      day1: !!(mask & EMAIL_DAY1),
      day7: !!(mask & EMAIL_DAY7),
      day13: !!(mask & EMAIL_DAY13),
      day15: !!(mask & EMAIL_DAY15),
    },
  });
});

module.exports = router;