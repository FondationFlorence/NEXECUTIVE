/**
 * Seed the monitored target universe + an initial set of M&A signals.
 *
 * This is demo/reference data representing the slice of the market the
 * platform actively monitors. It is idempotent: companies key on `slug`
 * and alerts are only inserted the first time a company is created, so the
 * migration is safe to re-run and never duplicates signals.
 */
const COMPANIES = [
  // slug, name, sector, country, hq_city, employees, revenue(M€), arr(M€), stage, valuation(M€), ownership, founded, growth%, heat, description, website
  ['helios-software',   'Helios Software',      'SaaS',           'Germany',     'Berlin',     420,  62,  48,  'Series C',     520,  'pe-backed',    2015, 41, 88, 'Vertical SaaS for mid-market manufacturers. €48M ARR, Series C, strong net retention.', 'helios.example'],
  ['apex-legal',        'Apex Legal',           'Legal Tech',     'Germany',     'Munich',     180,  24,  19,  'Series B',     140,  'private',      2017, 33, 71, 'Contract lifecycle management used by 600+ European law firms.', 'apexlegal.example'],
  ['nordveld',          'Nordveld Analytics',   'Fintech',        'Sweden',      'Stockholm',  310,  55,  44,  'Series C',     410,  'pe-backed',    2014, 38, 82, 'Risk analytics for Nordic retail banks. Regulatory-grade data pipelines.', 'nordveld.example'],
  ['lumen-health',      'Lumen Health',         'Healthtech',     'Netherlands', 'Amsterdam',  260,  41,  31,  'Series B',     290,  'private',      2016, 47, 79, 'Remote patient monitoring platform live across 4 EU health systems.', 'lumenhealth.example'],
  ['castellum-pay',     'Castellum Pay',        'Fintech',        'Spain',       'Madrid',     540,  88,  70,  'Series D',     760,  'pe-backed',    2013, 29, 84, 'Embedded payments for Iberian SMBs. Licensed EMI.', 'castellumpay.example'],
  ['orbithree',         'Orbithree',            'Cybersecurity',  'Ireland',     'Dublin',     150,  19,  16,  'Series B',     180,  'vc-backed',    2018, 62, 90, 'Cloud posture management. ARR tripled in 18 months.', 'orbithree.example'],
  ['greenmark',         'Greenmark Energy',     'Cleantech',      'Denmark',     'Copenhagen', 380,  72,  null,'Series C',     480,  'private',      2012, 26, 76, 'Grid-scale battery optimisation software for utilities.', 'greenmark.example'],
  ['veridian-bio',      'Veridian Bio',         'Healthtech',     'France',      'Paris',      210,  33,  null,'Series B',     240,  'vc-backed',    2017, 51, 73, 'Clinical trial data automation. Two pharma anchor clients.', 'veridianbio.example'],
  ['atlas-freight',     'Atlas Freight',        'Logistics',      'Netherlands', 'Rotterdam',  620,  130, null,'PE-owned',     540,  'pe-backed',    2009, 14, 58, 'Digital freight forwarding across Benelux and DACH.', 'atlasfreight.example'],
  ['monsieur-table',    'Monsieur Table',       'Foodtech',       'France',      'Lyon',       290,  47,  null,'Series C',     220,  'private',      2015, 22, 49, 'Restaurant SaaS + payments. 9,000 venues.', 'monsieurtable.example'],
  ['polaris-mobility',  'Polaris Mobility',     'Mobility',       'Finland',     'Helsinki',   175,  21,  17,  'Series B',     160,  'vc-backed',    2018, 55, 68, 'Fleet electrification analytics for logistics operators.', 'polaris.example'],
  ['terra-proptech',    'Terra Proptech',       'Proptech',       'Poland',      'Warsaw',     230,  28,  21,  'Series B',     150,  'private',      2016, 36, 61, 'Commercial real-estate underwriting automation for CEE markets.', 'terraproptech.example'],
  ['sentinel-ai',       'Sentinel AI',          'AI/ML',          'Germany',     'Berlin',     140,  16,  14,  'Series A',     190,  'vc-backed',    2020, 88, 94, 'Document intelligence for regulated industries. Hyper-growth.', 'sentinelai.example'],
  ['banca-nuvola',      'Banca Nuvola',         'Fintech',        'Italy',       'Milan',      460,  77,  61,  'Series C',     520,  'pe-backed',    2014, 31, 80, 'Cloud core-banking for cooperative banks.', 'bancanuvola.example'],
  ['quanta-insure',     'Quanta Insure',        'Insurtech',      'Belgium',     'Brussels',   200,  35,  27,  'Series B',     210,  'private',      2017, 44, 70, 'Parametric insurance underwriting platform.', 'quantainsure.example'],
  ['fjord-logistics',   'Fjord Logistics',      'Logistics',      'Norway',      'Oslo',       410,  92,  null,'PE-owned',     380,  'pe-backed',    2010, 11, 52, 'Cold-chain logistics tech for seafood exporters.', 'fjordlog.example'],
  ['adriatic-cloud',    'Adriatic Cloud',       'SaaS',           'Romania',     'Bucharest',  330,  44,  35,  'Series B',     260,  'vc-backed',    2016, 49, 75, 'DevOps automation platform with strong CEE footprint.', 'adriatic.example'],
  ['lusitania-med',     'Lusitania Med',        'Healthtech',     'Portugal',    'Lisbon',     160,  22,  null,'Series A',     120,  'vc-backed',    2019, 58, 66, 'AI triage software deployed in Iberian hospitals.', 'lusitaniamed.example'],
  ['wienfeld',          'Wienfeld Systems',     'Industrial',     'Austria',     'Vienna',     720,  185, null,'Family-owned', 640,  'family-owned', 2003, 8,  44, 'Industrial automation components. Succession in play.', 'wienfeld.example'],
  ['saga-commerce',     'Saga Commerce',        'E-commerce',     'Sweden',      'Gothenburg', 290,  58,  null,'Series C',     300,  'private',      2014, 24, 57, 'Headless commerce platform for Nordic D2C brands.', 'sagacommerce.example'],
  ['delta-secure',      'Delta Secure',         'Cybersecurity',  'France',      'Paris',      260,  40,  33,  'Series C',     350,  'pe-backed',    2015, 39, 86, 'Managed detection & response for the mid-market.', 'deltasecure.example'],
  ['brightlane',        'Brightlane',           'Legal Tech',     'Ireland',     'Dublin',     120,  15,  12,  'Series A',     95,   'vc-backed',    2019, 67, 69, 'AI due-diligence review for M&A counsel.', 'brightlane.example'],
  ['hanse-logistik',    'Hanse Logistik',       'Logistics',      'Germany',     'Hamburg',    540,  140, null,'PE-owned',     500,  'pe-backed',    2008, 12, 55, 'Port automation and customs tech for North Sea trade.', 'hanselogistik.example'],
  ['iberdata',          'Iberdata',             'AI/ML',          'Spain',       'Barcelona',  185,  23,  19,  'Series B',     200,  'vc-backed',    2018, 59, 83, 'Demand-forecasting AI for grocery retailers.', 'iberdata.example'],
  ['nimbus-cloud',      'Nimbus Cloud',         'SaaS',           'Denmark',     'Aarhus',     240,  37,  30,  'Series B',     250,  'private',      2016, 43, 74, 'FinOps cloud-cost platform with 200+ enterprise clients.', 'nimbuscloud.example'],
  ['valoria-pay',       'Valoria Pay',          'Fintech',        'Poland',      'Krakow',     370,  52,  42,  'Series C',     330,  'pe-backed',    2015, 34, 78, 'A2A payments rails across CEE.', 'valoriapay.example'],
  ['estuary-bio',       'Estuary Bio',          'Healthtech',     'Belgium',     'Ghent',      130,  18,  null,'Series A',     140,  'vc-backed',    2020, 71, 72, 'Genomics data platform for oncology research.', 'estuarybio.example'],
  ['kvarn-energy',      'Kvarn Energy',         'Cleantech',      'Finland',     'Tampere',    280,  49,  null,'Series C',     310,  'private',      2013, 28, 77, 'Industrial heat-recovery optimisation software.', 'kvarn.example'],
  ['romulus-soft',      'Romulus Software',     'SaaS',           'Italy',       'Rome',       310,  46,  37,  'Series B',     270,  'vc-backed',    2016, 40, 70, 'ERP for Southern-European SMB manufacturers.', 'romulussoft.example'],
  ['batavia-sec',       'Batavia Security',     'Cybersecurity',  'Netherlands', 'Utrecht',    175,  26,  22,  'Series B',     230,  'private',      2017, 53, 87, 'OT/IoT security for critical infrastructure.', 'bataviasec.example'],
];

// company slug -> alerts [type, severity, title, detail, source, regulator, daysAgo]
const ALERTS = {
  'helios-software': [
    ['acquisition', 'high',   'Acquisition signals detected', 'Two strategic acquirers flagged in sector; founder-CEO signalled openness to exit on a recent panel.', 'Sector chatter', null, 2],
    ['funding',     'medium', 'Bridge round closed ahead of Series D', 'Insiders extended a €15M bridge — typically a pre-exit liquidity move.', 'Filing', null, 9],
  ],
  'apex-legal': [
    ['regulatory',  'high',   'Regulatory filing in Germany — BaFin flag', 'New regulatory filing detected; due-diligence window opening on data-handling practices.', 'BaFin register', 'BaFin', 1],
  ],
  'nordveld': [
    ['leadership',  'medium', 'CFO departure', 'CFO stepped down after 6 years; succession often precedes a transaction.', 'Press', null, 5],
    ['market',      'medium', 'Nordic risk-analytics consolidation', '3 deals in the segment over 90 days — multiples expanding.', 'Market scan', null, 12],
  ],
  'castellum-pay': [
    ['regulatory',  'medium', 'EMI licence scope extended', 'Bank of Spain authorised expanded e-money scope — raises strategic value.', 'Regulator', 'ECB', 7],
  ],
  'orbithree': [
    ['funding',     'high',   'ARR tripled — inbound interest rising', 'Hyper-growth cyber asset; multiple PE funds tracking.', 'Market scan', null, 3],
    ['litigation',  'low',    'Minor IP dispute resolved', 'Patent dispute settled out of court — removes a diligence blocker.', 'Court record', null, 20],
  ],
  'sentinel-ai': [
    ['market',      'high',   'AI document-intelligence heat spike', 'Sector heat at 94 — comparable assets acquired at premium multiples this quarter.', 'Market scan', null, 1],
    ['funding',     'medium', 'Series A oversubscribed', 'Round 2.4x oversubscribed; signals scarcity and acquirer urgency.', 'Filing', null, 6],
  ],
  'banca-nuvola': [
    ['regulatory',  'medium', 'ECB cloud-banking guidance update', 'New supervisory expectations raise the bar for incumbents — favours modern cores.', 'Regulator', 'ECB', 8],
  ],
  'delta-secure': [
    ['acquisition', 'medium', 'Competitor acquired in adjacent segment', 'A direct competitor was acquired — likely to trigger sector re-rating.', 'Deal wire', null, 4],
  ],
  'wienfeld': [
    ['leadership',  'high',   'Succession event — family ownership in transition', 'Founder retiring; no internal successor named. Classic carve-out / sale setup.', 'Press', null, 2],
  ],
  'brightlane': [
    ['funding',     'medium', 'Strategic investor on cap table', 'A larger legal-tech took a minority stake — common pre-acquisition pattern.', 'Filing', null, 11],
  ],
  'iberdata': [
    ['market',      'medium', 'Retail-AI multiples expanding', 'Two comparable transactions closed above 8x ARR.', 'Market scan', null, 9],
  ],
  'batavia-sec': [
    ['regulatory',  'high',   'NIS2 enforcement raises strategic value', 'EU NIS2 enforcement is pulling OT-security demand forward — acquirers moving early.', 'Regulator', null, 3],
  ],
  'lumen-health': [
    ['regulatory',  'medium', 'GDPR data-processing audit passed', 'Clean audit removes a major diligence risk for health-data acquirers.', 'Audit', 'GDPR', 14],
  ],
  'valoria-pay': [
    ['market',      'medium', 'CEE payments consolidation underway', 'Two A2A players merged last month; Valoria a likely next target.', 'Market scan', null, 6],
  ],
};

async function insertCompany(client, row) {
  const [slug, name, sector, country, hq_city, employees, revM, arrM, stage, valM, ownership, founded, growth, heat, description, website] = row;
  const r = await client.query(
    `INSERT INTO companies
       (slug, name, sector, country, hq_city, employees, revenue_eur, arr_eur,
        funding_stage, valuation_eur, ownership, founded_year, growth_rate, sector_heat, description, website)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [
      slug, name, sector, country, hq_city, employees,
      revM != null ? revM * 1_000_000 : null,
      arrM != null ? arrM * 1_000_000 : null,
      stage,
      valM != null ? valM * 1_000_000 : null,
      ownership, founded, growth, heat, description, website,
    ],
  );
  return r.rows[0]?.id || null; // null when the company already existed
}

async function insertAlerts(client, companyId, alerts) {
  for (const [type, severity, title, detail, source, regulator, daysAgo] of alerts) {
    await client.query(
      `INSERT INTO alerts (company_id, type, severity, title, detail, source, regulator, signal_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() - ($8 || ' days')::interval)`,
      [companyId, type, severity, title, detail, source, regulator, String(daysAgo)],
    );
  }
}

module.exports = {
  name: 'seed_companies',
  up: async (client) => {
    for (const row of COMPANIES) {
      const id = await insertCompany(client, row);
      // Only seed alerts when the company was freshly inserted, so re-runs
      // never duplicate signals.
      if (id && ALERTS[row[0]]) {
        await insertAlerts(client, id, ALERTS[row[0]]);
      }
    }
  },
};
