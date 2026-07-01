/**
 * Digest schedule queries — per-user briefing delivery config.
 */
const { pool } = require('./index');

async function getForUser(userId) {
  const r = await pool.query(`SELECT * FROM digest_schedules WHERE user_id = $1`, [userId]);
  return r.rows[0] || null;
}

async function upsert(userId, { frequency = 'weekly', hour_utc = 8, enabled = true }) {
  const r = await pool.query(
    `INSERT INTO digest_schedules (user_id, frequency, hour_utc, enabled)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
       SET frequency = EXCLUDED.frequency,
           hour_utc  = EXCLUDED.hour_utc,
           enabled   = EXCLUDED.enabled,
           updated_at = NOW()
     RETURNING *`,
    [userId, frequency, hour_utc, enabled],
  );
  return r.rows[0];
}

module.exports = { getForUser, upsert };
