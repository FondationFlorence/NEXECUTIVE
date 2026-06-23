/**
 * Watchlist queries — the companies a user actively monitors.
 */
const { pool } = require('./index');

async function listForUser(userId) {
  const r = await pool.query(
    `SELECT c.*, w.fit_score AS cached_score, w.added_at
       FROM watchlist w
       JOIN companies c ON c.id = w.company_id
      WHERE w.user_id = $1
      ORDER BY w.added_at DESC`,
    [userId],
  );
  return r.rows;
}

async function ids(userId) {
  const r = await pool.query(`SELECT company_id FROM watchlist WHERE user_id = $1`, [userId]);
  return r.rows.map((x) => x.company_id);
}

async function isWatched(userId, companyId) {
  const r = await pool.query(
    `SELECT 1 FROM watchlist WHERE user_id = $1 AND company_id = $2`,
    [userId, companyId],
  );
  return r.rowCount > 0;
}

async function add(userId, companyId, fitScore = null) {
  await pool.query(
    `INSERT INTO watchlist (user_id, company_id, fit_score)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, company_id) DO UPDATE SET fit_score = EXCLUDED.fit_score`,
    [userId, companyId, fitScore],
  );
}

async function remove(userId, companyId) {
  await pool.query(`DELETE FROM watchlist WHERE user_id = $1 AND company_id = $2`, [userId, companyId]);
}

async function count(userId) {
  const r = await pool.query(`SELECT COUNT(*)::int AS n FROM watchlist WHERE user_id = $1`, [userId]);
  return r.rows[0].n;
}

module.exports = { listForUser, ids, isWatched, add, remove, count };
