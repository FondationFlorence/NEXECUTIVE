/**
 * Bildup entry point.
 * Wire middleware, route mounts, app.listen. All DB access via db/index.js.
 */
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { buildLandingContext } = require('./lib/landing-context');

require('./db/index'); // initialise pool; do NOT reassign it here

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

// Session secret: require it in production; fall back to an ephemeral random
// secret in dev (sessions won't survive a restart, which is fine locally).
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: SESSION_SECRET is required in production');
    process.exit(1);
  }
  sessionSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[server] SESSION_SECRET not set — using an ephemeral dev secret');
}

const isLocal = process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(require('express-session')({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: !isLocal, httpOnly: true, sameSite: 'lax' },
}));
if (!isLocal) app.set('trust proxy', 1); // honour X-Forwarded-Proto behind Render's proxy
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// View helpers available to every template as `fmt`.
app.locals.fmt = require('./lib/format');

app.get('/health', (_req, res) => res.json({ status: 'healthy' }));

// Serve static files from public folder with index:false so / doesn't serve index.html
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Landing page
app.get('/', (req, res) => res.render('layout', { ...buildLandingContext(), userId: req.session?.userId || null }));

// Auth pages (redirect to the workspace when already signed in)
app.get('/login', (req, res) => (req.session?.userId ? res.redirect('/dashboard') : res.render('login')));
app.get('/signup', (req, res) => (req.session?.userId ? res.redirect('/dashboard') : res.render('signup')));

// Auth API
app.use('/api/auth', require('./routes/auth'));

// Product workspace (all routes require auth)
app.use(require('./routes/app'));

// Checkout, trial email management
app.use(require('./routes/checkout'));
app.use('/api/trial-emails', require('./routes/trial-emails'));

// Error handler — log and return a minimal message.
app.use((err, _req, res, _next) => {
  console.error('[server] unhandled error:', err.stack || err.message);
  if (res.headersSent) return;
  res.status(500).send('Something went wrong.');
});

app.listen(port, () => console.log(`Server running on port ${port}`));
