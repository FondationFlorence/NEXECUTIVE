/**
 * Authenticated product routes — the M&A intelligence workspace.
 *
 *   GET  /dashboard            overview: watchlist, live signals, pipeline
 *   GET  /targets              screening engine over the target universe
 *   GET  /alerts               signal feed for the user's watchlist
 *   GET  /pipeline             deal pipeline board
 *   GET  /settings             digest delivery config
 *   GET  /company/:slug        target detail + score + brief
 *   POST /app/watchlist/add|remove
 *   POST /app/briefs/generate
 *   POST /app/pipeline/add|move|remove
 *   POST /app/settings/digest
 *
 * All routes require an authenticated session.
 */
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');

const companies = require('../db/companies');
const watchlist = require('../db/watchlist');
const alerts = require('../db/alerts');
const briefs = require('../db/briefs');
const pipeline = require('../db/pipeline');
const digests = require('../db/digests');
const { getUserById } = require('../db/users');
const { scoreCompany } = require('../services/scoring');
const { generateBrief } = require('../services/briefs');

router.use(requireAuth);

// Attach the current user to every request.
router.use(async (req, res, next) => {
  try {
    const user = await getUserById(req.session.userId);
    if (!user) return req.session.destroy(() => res.redirect('/login'));
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
});

function trialInfo(user) {
  const start = user.trial_start_date ? new Date(user.trial_start_date) : new Date();
  const daysUsed = Math.floor((Date.now() - start) / 86_400_000);
  const daysRemaining = 14 - daysUsed;
  return {
    daysRemaining,
    isExpired: daysRemaining <= 0,
    isPaid: user.subscription_status === 'active',
  };
}

/** Score a list of companies, attaching their recent signals. */
async function scoreList(rows) {
  const ids = rows.map((c) => c.id);
  const signalsByCompany = await alerts.forCompanyIds(ids);
  return rows.map((c) => {
    const signals = signalsByCompany[c.id] || [];
    return { ...c, signals, score: scoreCompany(c, { signals }) };
  });
}

const backTo = (req, fallback) => req.body.return_to || req.get('referer') || fallback;

// ---- Pages ----------------------------------------------------------------

router.get('/dashboard', async (req, res, next) => {
  try {
    const wl = await watchlist.listForUser(req.user.id);
    const scored = (await scoreList(wl)).sort((a, b) => b.score.total - a.score.total);
    const recentAlerts = await alerts.forUser(req.user.id, 8);
    const pipelineRows = await pipeline.listForUser(req.user.id);

    const stats = {
      universe: await companies.count(),
      watching: wl.length,
      signals30d: await alerts.countForUser(req.user.id, 30),
      hot: scored.filter((s) => s.score.total >= 75).length,
    };

    res.render('app/dashboard', {
      nav: 'dashboard', user: req.user, trial: trialInfo(req.user),
      watchlist: scored, recentAlerts, pipeline: pipelineRows, stats,
    });
  } catch (err) { next(err); }
});

router.get('/targets', async (req, res, next) => {
  try {
    const { q, sector, country, ownership } = req.query;
    const rows = await companies.search({ q, sector, country, ownership, limit: 60 });
    const scored = (await scoreList(rows)).sort((a, b) => b.score.total - a.score.total);
    const watchedIds = new Set(await watchlist.ids(req.user.id));

    res.render('app/targets', {
      nav: 'targets', user: req.user, trial: trialInfo(req.user),
      companies: scored, watchedIds,
      filters: { q: q || '', sector: sector || '', country: country || '', ownership: ownership || '' },
      sectors: await companies.distinctValues('sector'),
      countries: await companies.distinctValues('country'),
      ownerships: await companies.distinctValues('ownership'),
      total: await companies.count(),
    });
  } catch (err) { next(err); }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const rows = await alerts.forUser(req.user.id, 120);
    res.render('app/alerts', {
      nav: 'alerts', user: req.user, trial: trialInfo(req.user), alerts: rows,
    });
  } catch (err) { next(err); }
});

router.get('/pipeline', async (req, res, next) => {
  try {
    const rows = await pipeline.listForUser(req.user.id);
    const byStage = {};
    for (const s of pipeline.STAGES) byStage[s] = [];
    for (const row of rows) (byStage[row.stage] ||= []).push(row);

    res.render('app/pipeline', {
      nav: 'pipeline', user: req.user, trial: trialInfo(req.user),
      stages: pipeline.STAGES, byStage, total: rows.length,
    });
  } catch (err) { next(err); }
});

router.get('/settings', async (req, res, next) => {
  try {
    const digest = (await digests.getForUser(req.user.id)) || { frequency: 'weekly', hour_utc: 8, enabled: true };
    res.render('app/settings', {
      nav: 'settings', user: req.user, trial: trialInfo(req.user),
      digest, saved: req.query.saved === '1',
    });
  } catch (err) { next(err); }
});

router.get('/company/:slug', async (req, res, next) => {
  try {
    const company = await companies.getBySlug(req.params.slug);
    if (!company) return res.status(404).render('app/not-found', {
      nav: '', user: req.user, trial: trialInfo(req.user),
    });

    const signals = await alerts.forCompany(company.id, 50);
    const score = scoreCompany(company, { signals });
    const brief = await briefs.latestForCompany(req.user.id, company.id);

    res.render('app/company', {
      nav: 'targets', user: req.user, trial: trialInfo(req.user),
      company, signals, score, brief,
      watched: await watchlist.isWatched(req.user.id, company.id),
      inPipeline: await pipeline.isInPipeline(req.user.id, company.id),
    });
  } catch (err) { next(err); }
});

// ---- Actions --------------------------------------------------------------

router.post('/app/watchlist/add', async (req, res, next) => {
  try {
    const company = await companies.getById(parseInt(req.body.company_id, 10));
    if (company) {
      const signals = await alerts.forCompany(company.id, 50);
      const score = scoreCompany(company, { signals });
      await watchlist.add(req.user.id, company.id, score.total);
    }
    res.redirect(303, backTo(req, '/targets'));
  } catch (err) { next(err); }
});

router.post('/app/watchlist/remove', async (req, res, next) => {
  try {
    await watchlist.remove(req.user.id, parseInt(req.body.company_id, 10));
    res.redirect(303, backTo(req, '/dashboard'));
  } catch (err) { next(err); }
});

router.post('/app/briefs/generate', async (req, res, next) => {
  try {
    const company = await companies.getById(parseInt(req.body.company_id, 10));
    if (!company) return res.redirect(303, '/targets');
    const signals = await alerts.forCompany(company.id, 50);
    const score = scoreCompany(company, { signals });
    const { content, model } = await generateBrief(company, signals, score);
    await briefs.create({ userId: req.user.id, companyId: company.id, content, model });
    res.redirect(303, `/company/${company.slug}#brief`);
  } catch (err) { next(err); }
});

router.post('/app/pipeline/add', async (req, res, next) => {
  try {
    await pipeline.addCompany(req.user.id, parseInt(req.body.company_id, 10), { stage: 'sourced' });
    res.redirect(303, backTo(req, '/pipeline'));
  } catch (err) { next(err); }
});

router.post('/app/pipeline/move', async (req, res, next) => {
  try {
    await pipeline.move(req.user.id, parseInt(req.body.deal_id, 10), req.body.stage);
    res.redirect(303, '/pipeline');
  } catch (err) { next(err); }
});

router.post('/app/pipeline/remove', async (req, res, next) => {
  try {
    await pipeline.remove(req.user.id, parseInt(req.body.deal_id, 10));
    res.redirect(303, '/pipeline');
  } catch (err) { next(err); }
});

router.post('/app/settings/digest', async (req, res, next) => {
  try {
    await digests.upsert(req.user.id, {
      frequency: req.body.frequency || 'weekly',
      hour_utc: parseInt(req.body.hour_utc, 10) || 8,
      enabled: req.body.enabled === 'on' || req.body.enabled === 'true',
    });
    res.redirect(303, '/settings?saved=1');
  } catch (err) { next(err); }
});

module.exports = router;
