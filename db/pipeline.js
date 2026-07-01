/**
 * Pipeline queries — a user's live deal pipeline.
 */
const { pool } = require('./index');

const STAGES = ['sourced', 'screening', 'diligence', 'term_sheet', 'closed', 'passed'];

async function listForUser(userId) {
  const r = await pool.query(
    `SELECT p.*, c.name AS company_name, c.slug AS company_slug, c.sector, c.country
       FROM pipeline_deals p
       JOIN companies c ON c.id = p.company_id
      WHERE p.user_id = $1
      ORDER BY p.updated_at DESC`,
    [userId],
  );
  return r.rows;
}

/** Add a company to the pipeline (idempotent per user+company). */
async function addCompany(userId, companyId, { stage = 'sourced', owner, next_step } = {}) {
  const r = await pool.query(
    `INSERT INTO pipeline_deals (user_id, company_id, stage, owner, next_step)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, company_id) DO UPDATE
       SET stage = EXCLUDED.stage, updated_at = NOW()
     RETURNING *`,
    [userId, companyId, stage, owner || null, next_step || null],
  );
  return r.rows[0];
}

async function move(userId, dealId, stage) {
  if (!STAGES.includes(stage)) throw new Error(`invalid stage ${stage}`);
  const r = await pool.query(
    `UPDATE pipeline_deals SET stage = $3, updated_at = NOW()
      WHERE id = $2 AND user_id = $1 RETURNING *`,
    [userId, dealId, stage],
  );
  return r.rows[0] || null;
}

async function remove(userId, dealId) {
  await pool.query(`DELETE FROM pipeline_deals WHERE id = $2 AND user_id = $1`, [userId, dealId]);
}

async function isInPipeline(userId, companyId) {
  const r = await pool.query(
    `SELECT 1 FROM pipeline_deals WHERE user_id = $1 AND company_id = $2`,
    [userId, companyId],
  );
  return r.rowCount > 0;
}

module.exports = { STAGES, listForUser, addCompany, move, remove, isInPipeline };
