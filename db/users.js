/**
 * User queries. Accesses users table; does NOT own companies, alerts, etc.
 */
const { pool } = require('./index');

const EMAIL_DAY1 = 1;    // 0001
const EMAIL_DAY7 = 2;   // 0010
const EMAIL_DAY13 = 4;  // 0100
const EMAIL_DAY15 = 8;  // 1000

/** Return trial users who need email N (bit not set in email_sequence_sent).
 *  Trial users are created with subscription_status = 'trial'; only paid
 *  ('active') users are excluded from the nurture sequence. */
async function getUsersNeedingEmail(bitMask) {
  const r = await pool.query(
    `SELECT id, email, name, trial_start_date, email_sequence_sent
     FROM users
     WHERE trial_start_date IS NOT NULL
       AND subscription_status IS DISTINCT FROM 'active'
       AND email_sequence_sent & $1 = 0`,
    [bitMask],
  );
  return r.rows;
}

/** Mark email N as sent (set bit in email_sequence_sent). */
async function markEmailSent(userId, bitMask) {
  await pool.query(
    `UPDATE users SET email_sequence_sent = email_sequence_sent | $2 WHERE id = $1`,
    [userId, bitMask],
  );
}

/** Register a new trial user. */
async function createTrialUser({ email, name, trialStartDate }) {
  const r = await pool.query(
    `INSERT INTO users (email, name, trial_start_date, email_sequence_sent, subscription_status)
     VALUES ($1, $2, $3, 0, 'trial')
     ON CONFLICT (LOWER(email)) DO UPDATE
       SET trial_start_date = EXCLUDED.trial_start_date,
           email_sequence_sent = 0,
           subscription_status = 'trial'
     RETURNING id`,
    [email, name || null, trialStartDate],
  );
  return r.rows[0];
}

/** User is on a paid plan. */
async function isSubscribed(userId) {
  const r = await pool.query(
    `SELECT subscription_status FROM users WHERE id = $1`,
    [userId],
  );
  return r.rows[0]?.subscription_status === 'active';
}

/** Fetch a user by id. */
async function getUserById(id) {
  const r = await pool.query(
    `SELECT id, email, name, trial_start_date, subscription_status FROM users WHERE id = $1`,
    [id],
  );
  return r.rows[0];
}

module.exports = { getUsersNeedingEmail, markEmailSent, createTrialUser, isSubscribed, getUserById, EMAIL_DAY1, EMAIL_DAY7, EMAIL_DAY13, EMAIL_DAY15 };