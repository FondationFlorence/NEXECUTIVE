/**
 * Authenticated product routes — the searcher's acquisition workspace.
 *
 *   GET  /onboarding           thesis intake -> instant sourced shortlist
 *   GET  /dashboard            overview: shortlist, live sourced signals, pipeline
 *   GET  /targets              screening engine over the universe
 *   GET  /company/:slug        target detail + score + sourced brief
 *   GET  /alerts               sourced signal feed
 *   GET  /pipeline             deal pipeline board
 *   GET  /settings             thesis + digest + account
 *   POST /onboarding           save thesis, build shortlist
 *   POST /app/watchlist/(add|remove), /app/briefs/generate,
 *        /app/pipeline/(add|move|remove), /app/settings/(thesis|digest)
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
const theses = require('../db/theses');
const { getUserById, markActivated } = require('../db/users');
const { scoreCompany } = require('../services/scoring');
const { generateBrief } = require('../services/briefs');
const { matchThesis, normalizeThesisForm } = require('../services/thesis');
const { seedFromThesis } = require('../services/onboarding');
const { getContacts } = require('../services/enrichment');

router.use(requireAuth);

router.use(async (req, res, next) => {
  try {
    const user = await getUserById(req.session.userId);
    if (!user) return req.session.destroy(() => res.redirect('/login'));
    req.user = user;
    next();
  } catch (err) { next(err); }
});

function trialInfo(user) {
  const start = user.trial_start_date ? new Date(user.trial_start_date) : new Date();
  const daysUsed = Math.floor((Date.now() - start) / 86_400_000);
  const daysRemaining = 14 - daysUsed;
  return {
    daysRemaining,
    isExpired: daysRemaining <= 0,
    isPaid: user.subscription_status === 'active',
    activated: !!user.activated_at,
  };
}

async function scoreList(rows) {
  const ids = rows.map((c) => c.id);
  const signalsByCompany = await alerts.forCompanyIds(ids);
  return rows.map((c) => {
    const signals = signalsByCompany[c.id] || [];
    return { ...c, signals, score: scoreCompany(c, { signals }) };
  });
}

const backTo = (req, fallback) => req.body.return_to || req.get('referer') || fallback;

async function thesisOptions() {
  return {
    sectors: await companies.distinctValues('sector'),
    countries: await companies.distinctValues('country'),
  };
}

// ---- Onboarding (activation) ---------------------------------------------

router.get('/onboarding', async (req, res, next) => {
  try {
    const thesis = await theses.getForUser(req.user.id);
    res.render('app/onboarding', {
      nav: '', user: req.user, trial: trialInfo(req.user),
      thesis, ...(await thesisOptions()), total: await companies.count(),
    });
  } catch (err) { next(err); }
});

router.post('/onboarding', async (req, res, next) => {
  try {
    const thesis = normalizeThesisForm(req.body);
    await theses.upsert(req.user.id, thesis);
    await seedFromThesis(req.user.id, thesis); // build the shortlist into the workspace
    res.redirect(303, '/dashboard');
  } catch (err) { next(err); }
});

// ---- Pages ----------------------------------------------------------------

router.get('/dashboard', async (req, res, next) => {
  try {
    const thesis = await theses.getForUser(req.user.id);
    const wl = await watchlist.listForUser(req.user.id);
    const scored = (await scoreList(wl))
      .map((c) => ({ ...c, match: matchThesis(c, thesis) }))
      .sort((a, b) => b.match.match - a.match.match || b.score.total - a.score.total);
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
      thesis, watchlist: scored, recentAlerts, pipeline: pipelineRows, stats,
      needsThesis: !thesis,
    });
  } catch (err) { next(err); }
});

router.get('/targets', async (req, res, next) => {
  try {
    const { q, sector, country, ownership } = req.query;
    const thesis = await theses.getForUser(req.user.id);
    const rows = await companies.search({ q, sector, country, ownership, limit: 60 });
    const scored = (await scoreList(rows))
      .map((c) => ({ ...c, match: matchThesis(c, thesis) }))
      .sort((a, b) => b.score.total - a.score.total);
    const watchedIds = new Set(await watchlist.ids(req.user.id));

    res.render('app/targets', {
      nav: 'targets', user: req.user, trial: trialInfo(req.user),
      companies: scored, watchedIds, hasThesis: !!thesis,
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
    res.render('app/alerts', { nav: 'alerts', user: req.user, trial: trialInfo(req.user), alerts: rows });
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
    const thesis = await theses.getForUser(req.user.id);
    res.render('app/settings', {
      nav: 'settings', user: req.user, trial: trialInfo(req.user),
      digest, thesis, ...(await thesisOptions()),
      saved: req.query.saved === '1',
    });
  } catch (err) { next(err); }
});

router.get('/company/:slug', async (req, res, next) => {
  try {
    const company = await companies.getBySlug(req.params.slug);
    if (!company) return res.status(404).render('app/not-found', { nav: '', user: req.user, trial: trialInfo(req.user) });
    const signals = await alerts.forCompany(company.id, 50);
    const score = scoreCompany(company, { signals });
    const brief = await briefs.latestForCompany(req.user.id, company.id);
    const contacts = await getContacts(company);
    res.render('app/company', {
      nav: 'targets', user: req.user, trial: trialInfo(req.user),
      company, signals, score, brief, contacts,
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
      await watchlist.add(req.user.id, company.id, scoreCompany(company, { signals }).total);
      await markActivated(req.user.id);
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
    const contacts = await getContacts(company);
    const { content, model } = await generateBrief(company, signals, score, contacts);
    await briefs.create({ userId: req.user.id, companyId: company.id, content, model });
    await markActivated(req.user.id);
    res.redirect(303, `/company/${company.slug}#brief`);
  } catch (err) { next(err); }
});

router.post('/app/pipeline/add', async (req, res, next) => {
  try {
    await pipeline.addCompany(req.user.id, parseInt(req.body.company_id, 10), { stage: 'sourced' });
    await markActivated(req.user.id);
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

router.post('/app/settings/thesis', async (req, res, next) => {
  try {
    const thesis = normalizeThesisForm(req.body);
    await theses.upsert(req.user.id, thesis);
    await seedFromThesis(req.user.id, thesis); // refresh the shortlist with new matches
    res.redirect(303, '/settings?saved=1');
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
