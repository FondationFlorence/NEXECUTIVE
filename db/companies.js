/**
 * Company queries — the monitored target universe.
 */
const { pool } = require('./index');

async function getById(id) {
  const r = await pool.query(`SELECT * FROM companies WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

async function getBySlug(slug) {
  const r = await pool.query(`SELECT * FROM companies WHERE slug = $1`, [slug]);
  return r.rows[0] || null;
}

/** Filtered search over the universe. */
async function search({ q, sector, country, ownership, limit = 60, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (q) { params.push(`%${q}%`); where.push(`(c.name ILIKE $${params.length} OR c.description ILIKE $${params.length})`); }
  if (sector) { params.push(sector); where.push(`c.sector = $${params.length}`); }
  if (country) { params.push(country); where.push(`c.country = $${params.length}`); }
  if (ownership) { params.push(ownership); where.push(`c.ownership = $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(limit); const limIdx = params.length;
  params.push(offset); const offIdx = params.length;
  const r = await pool.query(
    `SELECT c.*,
            COALESCE(a.cnt, 0)  AS alert_count,
            a.last_signal
       FROM companies c
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS cnt, MAX(signal_date) AS last_signal
           FROM alerts al
          WHERE al.company_id = c.id
            AND al.signal_date > NOW() - interval '45 days'
       ) a ON true
       ${clause}
       ORDER BY c.sector_heat DESC NULLS LAST, c.name
       LIMIT $${limIdx} OFFSET $${offIdx}`,
    params,
  );
  return r.rows;
}

async function distinctValues(column) {
  const allowed = ['sector', 'country', 'ownership'];
  if (!allowed.includes(column)) throw new Error(`bad column ${column}`);
  const r = await pool.query(`SELECT DISTINCT ${column} AS v FROM companies WHERE ${column} IS NOT NULL ORDER BY v`);
  return r.rows.map((x) => x.v);
}

async function count() {
  const r = await pool.query(`SELECT COUNT(*)::int AS n FROM companies`);
  return r.rows[0].n;
}

module.exports = { getById, getBySlug, search, distinctValues, count };
