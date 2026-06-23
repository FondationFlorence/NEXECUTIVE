/**
 * Deal brief persistence — AI-generated executive briefings.
 */
const { pool } = require('./index');

async function create({ userId, companyId, content, model }) {
  const r = await pool.query(
    `INSERT INTO deal_briefs (user_id, company_id, content, model)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, companyId, content, model || null],
  );
  return r.rows[0];
}

async function latestForCompany(userId, companyId) {
  const r = await pool.query(
    `SELECT * FROM deal_briefs
      WHERE user_id = $1 AND company_id = $2
      ORDER BY created_at DESC LIMIT 1`,
    [userId, companyId],
  );
  return r.rows[0] || null;
}

async function listForUser(userId, limit = 20) {
  const r = await pool.query(
    `SELECT b.*, c.name AS company_name, c.slug AS company_slug
       FROM deal_briefs b
       JOIN companies c ON c.id = b.company_id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return r.rows;
}

module.exports = { create, latestForCompany, listForUser };
