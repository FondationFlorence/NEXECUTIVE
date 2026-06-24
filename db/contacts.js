/**
 * Contact queries — key people per company (decision-makers to approach).
 */
const { pool } = require('./index');

async function forCompany(companyId) {
  const r = await pool.query(
    `SELECT * FROM contacts WHERE company_id = $1 ORDER BY id`,
    [companyId],
  );
  return r.rows;
}

async function create({ company_id, name, role, email, linkedin_url, personal_email, phone, source, source_url, confidence }) {
  const r = await pool.query(
    `INSERT INTO contacts (company_id, name, role, email, linkedin_url, personal_email, phone, source, source_url, confidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [company_id, name, role || null, email || null, linkedin_url || null, personal_email || null, phone || null, source || null, source_url || null, confidence || null],
  );
  return r.rows[0];
}

module.exports = { forCompany, create };
