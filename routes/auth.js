/**
 * Auth routes: signup, login, logout.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { pool } = require('../db/index');
const { seedStarterWatchlist } = require('../services/onboarding');

router.post('/signup', express.json(), async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `INSERT INTO users (email, name, password_hash, trial_start_date, subscription_status)
       VALUES ($1, $2, $3, NOW(), 'trial')
       ON CONFLICT (LOWER(email)) DO UPDATE
         SET name = EXCLUDED.name,
             password_hash = EXCLUDED.password_hash,
             trial_start_date = NOW(),
             email_sequence_sent = 0,
             subscription_status = 'trial'
       RETURNING id`,
      [email, name || null, passwordHash],
    );
    req.session.userId = r.rows[0].id;

    // Best-effort: give the new account a live workspace. Never block signup.
    try {
      await seedStarterWatchlist(r.rows[0].id);
    } catch (seedErr) {
      console.error('[auth] onboarding seed failed (non-fatal):', seedErr.message);
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[auth] signup error:', err.message);
    res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/login', express.json(), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const r = await pool.query(
      `SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER($1)`,
      [email],
    );
    if (!r.rows[0]) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, r.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = r.rows[0].id;
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth] login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;