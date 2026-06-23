/**
 * Database singleton — only module allowed to create new Pool().
 * All DB access goes through db/ modules, never inline pool.query().
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

// Neon closes idle connections (auto-suspend). Log and keep serving.
pool.on('error', (err) => {
  console.error('[pg pool] idle client error (non-fatal):', err && err.message);
});

module.exports = { pool };