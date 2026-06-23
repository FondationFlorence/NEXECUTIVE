/**
 * Nexecutive entry point.
 * Wire middleware, route mounts, app.listen. All DB access via db/index.js.
 */
const express = require('express');
const path = require('path');
const { buildLandingContext } = require('./lib/landing-context');

require('./db/index'); // initialise pool; do NOT reassign it here

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

app.use(express.json());
app.use(require('express-session')({
  secret: process.env.SESSION_SECRET || 'REDACTED',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: !process.env.DATABASE_URL?.includes('localhost'), httpOnly: true, sameSite: 'lax' },
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/health', (_req, res) => res.json({ status: 'healthy' }));

// Serve static files from public folder with index:false so / doesn't serve index.html
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Landing page
app.get('/', (req, res) => res.render('layout', { ...buildLandingContext(), userId: req.session?.userId || null }));

// Auth routes
app.use('/api/auth', require('./routes/auth'));

// Protected dashboard
app.get('/dashboard', require('./middleware/auth'), async (req, res) => {
  const { getUserById } = require('./db/users');
  const user = await getUserById(req.session.userId);
  if (!user) return res.redirect('/login');
  res.render('dashboard', { user });
});

// Checkout, trial email management
app.use(require('./routes/checkout'));
app.use('/api/trial-emails', require('./routes/trial-emails'));

app.listen(port, () => console.log(`Server running on port ${port}`));