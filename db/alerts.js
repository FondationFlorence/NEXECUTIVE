/**
 * Alert queries — M&A signals generated per company.
 */
const { pool } = require('./index');

async function forCompany(companyId, limit = 50) {
  const r = await pool.query(
    `SELECT * FROM alerts WHERE company_id = $1 ORDER BY signal_date DESC LIMIT $2`,
    [companyId, limit],
  );
  return r.rows;
}

/** Alerts for every company a user monitors, newest first (with company name). */
async function forUser(userId, limit = 60) {
  const r = await pool.query(
    `SELECT a.*, c.name AS company_name, c.slug AS company_slug, c.sector
       FROM alerts a
       JOIN watchlist w ON w.company_id = a.company_id AND w.user_id = $1
       JOIN companies c ON c.id = a.company_id
      ORDER BY a.signal_date DESC
      LIMIT $2`,
    [userId, limit],
  );
  return r.rows;
}

/** Signals grouped by company id, for a set of companies. */
async function forCompanyIds(ids) {
  if (!ids || ids.length === 0) return {};
  const r = await pool.query(
    `SELECT * FROM alerts WHERE company_id = ANY($1::int[]) ORDER BY signal_date DESC`,
    [ids],
  );
  const map = {};
  for (const row of r.rows) (map[row.company_id] ||= []).push(row);
  return map;
}

async function create({ company_id, type, severity = 'medium', title, detail, source, regulator }) {
  const r = await pool.query(
    `INSERT INTO alerts (company_id, type, severity, title, detail, source, regulator)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [company_id, type, severity, title, detail || null, source || null, regulator || null],
  );
  return r.rows[0];
}

/** Count of signals in the last `days` for a user's watchlist. */
async function countForUser(userId, days = 30) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM alerts a
       JOIN watchlist w ON w.company_id = a.company_id AND w.user_id = $1
      WHERE a.signal_date > NOW() - ($2 || ' days')::interval`,
    [userId, String(days)],
  );
  return r.rows[0].n;
}

module.exports = { forCompany, forUser, forCompanyIds, create, countForUser };
