/**
 * Acquisition thesis persistence (one per user).
 */
const { pool } = require('./index');

async function getForUser(userId) {
  const r = await pool.query(`SELECT * FROM theses WHERE user_id = $1`, [userId]);
  return r.rows[0] || null;
}

async function upsert(userId, { sectors, countries, rev_min, rev_max, keywords }) {
  const r = await pool.query(
    `INSERT INTO theses (user_id, sectors, countries, rev_min, rev_max, keywords)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE
       SET sectors = EXCLUDED.sectors,
           countries = EXCLUDED.countries,
           rev_min = EXCLUDED.rev_min,
           rev_max = EXCLUDED.rev_max,
           keywords = EXCLUDED.keywords,
           updated_at = NOW()
     RETURNING *`,
    [userId, sectors || null, countries || null, rev_min, rev_max, keywords || null],
  );
  return r.rows[0];
}

module.exports = { getForUser, upsert };
