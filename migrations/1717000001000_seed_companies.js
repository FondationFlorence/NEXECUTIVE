/**
 * Seed the monitored target universe + sourced M&A signals.
 *
 * Positioning: lower-mid-market acquisition targets across core European
 * markets (FR / UK / DE / AT / NL / IE) for individual acquirers (searchers,
 * ETA, independent sponsors). Every company is tied to its official registry,
 * and every signal carries a primary-source URL — the verifiability promise.
 *
 * Idempotent: companies key on `slug`; alerts are only inserted the first time
 * a company is created, so re-running never duplicates signals.
 *
 * NOTE: this is reference/demo data — entities are illustrative. The registry
 * and source URLs use the real official domains to model the verifiability
 * chain; live fetchers (Companies House, BODACC, Infogreffe, CFNEWS) plug into
 * jobs/signal-monitor.js.
 */
const M = 1_000_000;

// Per-country official registry + base URL for a company record.
const REGISTRY = {
  UK:      { name: 'Companies House', base: 'https://find-and-update.company-information.service.gov.uk/company/' },
  France:  { name: 'Infogreffe / Pappers', base: 'https://www.pappers.fr/entreprise/' },
  Germany: { name: 'Handelsregister', base: 'https://www.handelsregister.de/rp_web/' },
  Austria: { name: 'Firmenbuch', base: 'https://firmenbuch.at/' },
  Netherlands: { name: 'KVK', base: 'https://www.kvk.nl/zoeken/?q=' },
  Ireland: { name: 'CRO', base: 'https://core.cro.ie/' },
};

const CFNEWS = 'https://www.cfnews.net/';
const BODACC = 'https://www.bodacc.fr/';

// slug, name, sector, country, city, employees, revenue(M€), ebitda(M€), ownership,
// founded, growth%, sector_heat, owner_age, availability, registryRef (suffix on base), description
const C = [
  // ---- France --------------------------------------------------------------
  ['froid-atlantique', 'Froid Atlantique', 'HVAC & Refrigeration', 'France', 'Nantes', 64, 9.2, 1.4, 'owner-managed', 1996, 7, 84, 63, 'off-market', '498201634', 'Commercial refrigeration install & maintenance for food retail across western France. Recurring service contracts.'],
  ['clermont-usinage', 'Clermont Usinage', 'Specialty Manufacturing', 'France', 'Clermont-Ferrand', 48, 7.1, 1.1, 'family-owned', 1984, 4, 58, 67, 'exploring', '402558190', 'Precision machining for aerospace & industrial OEMs. Founder approaching retirement, no successor.'],
  ['proprenet-services', 'Propre-Net Services', 'Commercial Cleaning', 'France', 'Lyon', 210, 12.4, 1.6, 'owner-managed', 2001, 9, 71, 59, 'off-market', '441027885', 'B2B facility cleaning across Auvergne-Rhône-Alpes. Diversified contract base, low churn.'],
  ['hydrowest', 'HydroWest', 'Water Treatment', 'France', 'Bordeaux', 38, 5.8, 1.0, 'founder-led', 2009, 14, 76, 55, 'exploring', '512339027', 'Industrial water-treatment systems & service for wineries and food processors.'],
  ['logi-garonne', 'Logi-Garonne', 'Logistics & Transport', 'France', 'Toulouse', 95, 16.3, 1.3, 'family-owned', 1979, 3, 49, 69, 'rumoured', '317884520', 'Regional palletised freight & warehousing. Second-generation owners seeking exit.'],

  // ---- United Kingdom ------------------------------------------------------
  ['penmoor-elevators', 'Penmoor Elevators', 'Elevator Maintenance', 'UK', 'Birmingham', 72, 8.9, 1.7, 'owner-managed', 1992, 6, 88, 64, 'off-market', '02884771', 'Lift service & modernisation, ~1,400 units under contract. Sticky recurring revenue.'],
  ['aldgate-testing', 'Aldgate Testing & Inspection', 'Test & Inspection', 'UK', 'Manchester', 54, 6.7, 1.2, 'founder-led', 2005, 12, 79, 58, 'exploring', '05417762', 'Non-destructive testing for construction & energy. Accredited, asset-light.'],
  ['northfield-msp', 'Northfield IT', 'IT Managed Services', 'UK', 'Leeds', 41, 5.2, 1.1, 'owner-managed', 2010, 17, 86, 56, 'off-market', '07331902', 'MSP for SME professional-services firms. 90%+ recurring, strong NRR.'],
  ['brackley-vet', 'Brackley Veterinary Group', 'Veterinary Services', 'UK', 'Oxford', 88, 7.4, 1.5, 'family-owned', 1988, 8, 90, 66, 'rumoured', '02110784', 'Five-site small-animal vet group. Consolidator interest rising in the segment.'],
  ['severn-packaging', 'Severn Packaging', 'Packaging', 'UK', 'Bristol', 130, 18.6, 2.2, 'family-owned', 1975, 4, 55, 71, 'exploring', '01209934', 'Corrugated packaging manufacturer. Succession driven, owner 71.'],

  // ---- Germany -------------------------------------------------------------
  ['rheinluft-klima', 'Rheinluft Klimatechnik', 'HVAC & Refrigeration', 'Germany', 'Cologne', 78, 11.8, 1.9, 'family-owned', 1981, 5, 83, 68, 'exploring', 'HRB-rheinluft', 'Commercial HVAC install & service for Mittelstand industry. Classic Nachfolge case.'],
  ['saarmetall-werk', 'Saarmetall Werk', 'Specialty Manufacturing', 'Germany', 'Saarbrücken', 165, 27.5, 3.1, 'family-owned', 1968, 2, 52, 70, 'rumoured', 'HRB-saarmetall', 'Metal components for automotive tier-2. Succession + transformation pressure.'],
  ['bavaria-labortech', 'Bavaria Labortechnik', 'Healthcare Services', 'Germany', 'Munich', 60, 9.6, 1.8, 'founder-led', 2003, 15, 80, 57, 'off-market', 'HRB-bavlab', 'Lab logistics & diagnostics support for clinics. Recurring, regulated.'],
  ['nordsee-umwelt', 'Nordsee Umweltservice', 'Environmental Services', 'Germany', 'Hamburg', 112, 15.2, 2.0, 'owner-managed', 1994, 7, 74, 62, 'exploring', 'HRB-nordsee', 'Industrial waste & remediation services for the port economy.'],
  ['elbe-aufzug', 'Elbe Aufzug', 'Elevator Maintenance', 'Germany', 'Dresden', 49, 6.3, 1.2, 'family-owned', 1990, 6, 87, 69, 'off-market', 'HRB-elbeauf', 'Lift maintenance across Saxony. ~700 units, succession driven.'],

  // ---- Austria -------------------------------------------------------------
  ['alpin-gebaeude', 'Alpin Gebäudetechnik', 'HVAC & Facilities', 'Austria', 'Innsbruck', 56, 8.1, 1.3, 'family-owned', 1987, 6, 81, 67, 'exploring', 'FN-alpin', 'Building-services contractor for hospitality & commercial. Owner seeking succession.'],
  ['wiener-prueftechnik', 'Wiener Prüftechnik', 'Test & Inspection', 'Austria', 'Vienna', 44, 5.6, 1.0, 'founder-led', 2007, 11, 78, 55, 'off-market', 'FN-wienpruef', 'Inspection & certification for lifts and pressure equipment. Accredited.'],
  ['steirer-logistik', 'Steirer Logistik', 'Logistics & Transport', 'Austria', 'Graz', 83, 13.4, 1.2, 'family-owned', 1983, 3, 47, 70, 'rumoured', 'FN-steirer', 'Regional distribution & contract logistics. Second generation, no successor.'],

  // ---- Netherlands / Ireland ----------------------------------------------
  ['delft-aandrijf', 'Delft Aandrijftechniek', 'B2B Distribution', 'Netherlands', 'Delft', 39, 7.9, 1.1, 'owner-managed', 1998, 8, 60, 61, 'exploring', 'delft-aandrijf', 'Distributor of drive & automation components. Loyal industrial customer base.'],
  ['shannon-coldchain', 'Shannon Cold Chain', 'Logistics & Transport', 'Ireland', 'Limerick', 67, 10.7, 1.5, 'founder-led', 2002, 13, 72, 58, 'off-market', 'shannon-coldchain', 'Temperature-controlled logistics for food & pharma. Strong growth.'],
];

// slug -> [type, severity, title, detail, sourceName, sourceUrl, daysAgo]
const A = {
  'froid-atlantique': [
    ['succession', 'high', 'Owner 63, no named successor', 'Director records show a sole owner-manager aged 63 with no transfer of shares filed — a textbook succession window.', 'Infogreffe / Pappers', 'https://www.pappers.fr/entreprise/froid-atlantique-498201634', 2],
    ['filing', 'medium', '2025 accounts filed — EBITDA margin 15%', 'Latest statutory accounts published; service revenue stable, margins intact.', 'Infogreffe / Pappers', 'https://www.pappers.fr/entreprise/froid-atlantique-498201634#comptes', 12],
  ],
  'clermont-usinage': [
    ['availability', 'high', 'Advisor mandate signalled', 'A regional M&A boutique referenced an aerospace-machining mandate matching this profile.', 'CFNEWS', CFNEWS + 'l-actualite/transactions/cessions-pme-aero-auvergne', 4],
    ['succession', 'medium', 'Founder 67, family-owned', 'Long-held family ownership with founder past 65 — exploring exit.', 'Infogreffe / Pappers', 'https://www.pappers.fr/entreprise/clermont-usinage-402558190', 9],
  ],
  'proprenet-services': [
    ['market', 'medium', 'Cleaning roll-up active in France', 'Two PE-backed platforms are consolidating regional B2B cleaning — multiples firming.', 'CFNEWS', CFNEWS + 'l-actualite/build-up/proprete-b2b-consolidation', 6],
  ],
  'hydrowest': [
    ['deal', 'medium', 'Comparable water-treatment deal closed', 'A comparable industrial water-treatment SME changed hands this quarter (sourced).', 'CFNEWS', CFNEWS + 'l-actualite/transactions/traitement-eau-industriel', 8],
  ],
  'logi-garonne': [
    ['ownership', 'high', 'BODACC: share-transfer notice', 'Official legal gazette published a partial share-transfer notice — ownership in motion.', 'BODACC', BODACC + 'annonce/2026-A-12840', 3],
  ],
  'penmoor-elevators': [
    ['succession', 'high', 'Owner 64, sole shareholder', 'Companies House confirms a single PSC aged 64 — recurring-revenue asset, prime for a managed exit.', 'Companies House', 'https://find-and-update.company-information.service.gov.uk/company/02884771/persons-with-significant-control', 1],
    ['filing', 'low', 'Confirmation statement filed', 'Annual confirmation statement up to date; ~1,400 units under contract noted in accounts.', 'Companies House', 'https://find-and-update.company-information.service.gov.uk/company/02884771/filing-history', 16],
  ],
  'aldgate-testing': [
    ['market', 'medium', 'TIC consolidation heat', 'Testing-inspection-certification roll-ups are pricing accredited assets at a premium.', 'CFNEWS', CFNEWS + 'l-actualite/build-up/tic-consolidation-europe', 7],
  ],
  'northfield-msp': [
    ['availability', 'high', 'Off-market MSP, owner exploring', 'Owner-manager aged 56 signalled openness to a sale; 90%+ recurring revenue.', 'Companies House', 'https://find-and-update.company-information.service.gov.uk/company/07331902', 2],
    ['market', 'medium', 'MSP roll-up multiples expanding', 'SME-focused MSP platforms paying up for sticky recurring bases.', 'CFNEWS', CFNEWS + 'l-actualite/build-up/msp-it-services', 11],
  ],
  'brackley-vet': [
    ['deal', 'high', 'Vet-group consolidator active nearby', 'A consolidator closed an adjacent multi-site vet acquisition — segment in play.', 'CFNEWS', CFNEWS + 'l-actualite/transactions/veterinaire-build-up', 3],
  ],
  'severn-packaging': [
    ['succession', 'high', 'Owner 71 — succession overdue', 'Family ownership with principal aged 71 and no filed succession plan.', 'Companies House', 'https://find-and-update.company-information.service.gov.uk/company/01209934/persons-with-significant-control', 5],
  ],
  'rheinluft-klima': [
    ['succession', 'high', 'Nachfolge: owner 68, family-held', 'Handelsregister shows long-standing family ownership; principal aged 68.', 'Handelsregister', 'https://www.handelsregister.de/rp_web/', 4],
  ],
  'saarmetall-werk': [
    ['ownership', 'medium', 'Registered charge added', 'A new charge/security entry suggests refinancing or transaction prep.', 'Handelsregister', 'https://www.handelsregister.de/rp_web/', 6],
    ['deal', 'medium', 'Tier-2 automotive carve-outs accelerating', 'Succession + EV transition is pushing Mittelstand suppliers to sell.', 'CFNEWS', CFNEWS + 'l-actualite/transactions/mittelstand-automotive', 13],
  ],
  'bavaria-labortech': [
    ['market', 'medium', 'Lab-services consolidation', 'Diagnostics-support roll-ups expanding across DACH.', 'CFNEWS', CFNEWS + 'l-actualite/build-up/lab-services-dach', 9],
  ],
  'nordsee-umwelt': [
    ['filing', 'medium', 'Annual accounts published', 'Bundesanzeiger filing confirms stable EBITDA on remediation contracts.', 'Handelsregister', 'https://www.handelsregister.de/rp_web/', 14],
  ],
  'elbe-aufzug': [
    ['succession', 'high', 'Owner 69, ~700 units under contract', 'Recurring lift-maintenance base with an owner past retirement age.', 'Handelsregister', 'https://www.handelsregister.de/rp_web/', 2],
  ],
  'alpin-gebaeude': [
    ['succession', 'medium', 'Firmenbuch: owner 67, family-held', 'Austrian commercial register shows succession-stage family ownership.', 'Firmenbuch', 'https://firmenbuch.at/', 5],
  ],
  'wiener-prueftechnik': [
    ['market', 'medium', 'Inspection assets bid up', 'Accredited inspection businesses are scarce and competitively bid.', 'CFNEWS', CFNEWS + 'l-actualite/build-up/inspection-certification', 8],
  ],
  'steirer-logistik': [
    ['ownership', 'high', 'Firmenbuch: shareholding change filed', 'A shareholding change entry indicates ownership transition underway.', 'Firmenbuch', 'https://firmenbuch.at/', 3],
  ],
  'delft-aandrijf': [
    ['availability', 'medium', 'KVK: owner exploring exit', 'Owner-managed distributor; principal aged 61 exploring a transfer.', 'KVK', 'https://www.kvk.nl/', 7],
  ],
  'shannon-coldchain': [
    ['deal', 'medium', 'Cold-chain logistics in demand', 'Pharma/food cold-chain assets attracting strategic and PE interest.', 'CFNEWS', CFNEWS + 'l-actualite/transactions/cold-chain-logistics', 6],
  ],
};

// slug -> [name, role, email, linkedin, personal_email, confidence]
// Identity/role come from the registry officers (high confidence); work email
// is an inferred pattern; personal_email is left null for downstream enrichment.
const CONTACTS = {
  'froid-atlantique': [['Jean-Marc Brèthes', 'Gérant & Owner', 'jm.brethes@froid-atlantique.eu', 'https://www.linkedin.com/in/jean-marc-brethes', null, 'high']],
  'clermont-usinage': [['Bernard Faure', 'Président (Founder)', 'b.faure@clermont-usinage.eu', 'https://www.linkedin.com/in/bernard-faure-usinage', null, 'high']],
  'proprenet-services': [['Sylvie Marchand', 'Gérante', 's.marchand@proprenet.eu', 'https://www.linkedin.com/in/sylvie-marchand-services', null, 'high']],
  'penmoor-elevators': [
    ['Geoffrey Pemberton', 'Managing Director & Owner', 'g.pemberton@penmoor.co.uk', 'https://www.linkedin.com/in/geoffrey-pemberton', null, 'high'],
    ['Alan Whitcombe', 'Finance Director', 'a.whitcombe@penmoor.co.uk', 'https://www.linkedin.com/in/alan-whitcombe', null, 'medium'],
  ],
  'aldgate-testing': [['Priya Nair', 'Founder & MD', 'p.nair@aldgate-testing.co.uk', 'https://www.linkedin.com/in/priya-nair-ndt', null, 'high']],
  'northfield-msp': [['Daniel Okafor', 'Founder & MD', 'd.okafor@northfield-it.co.uk', 'https://www.linkedin.com/in/daniel-okafor-msp', null, 'high']],
  'brackley-vet': [['Margaret Ellison', 'Senior Partner & Owner', 'm.ellison@brackleyvet.co.uk', 'https://www.linkedin.com/in/margaret-ellison-dvm', null, 'high']],
  'severn-packaging': [
    ['Roy Hartley', 'Chairman & Owner', 'r.hartley@severn-packaging.co.uk', 'https://www.linkedin.com/in/roy-hartley-packaging', null, 'high'],
    ['Karen Liddell', 'Finance Director', 'k.liddell@severn-packaging.co.uk', 'https://www.linkedin.com/in/karen-liddell', null, 'medium'],
  ],
  'rheinluft-klima': [['Klaus Hofmann', 'Geschäftsführer (Owner)', 'k.hofmann@rheinluft.de', 'https://www.linkedin.com/in/klaus-hofmann-klima', null, 'high']],
  'saarmetall-werk': [['Dieter Vogel', 'Geschäftsführender Gesellschafter', 'd.vogel@saarmetall.de', 'https://www.linkedin.com/in/dieter-vogel-saar', null, 'high']],
  'elbe-aufzug': [['Heinz Brandt', 'Inhaber & Geschäftsführer', 'h.brandt@elbe-aufzug.de', 'https://www.linkedin.com/in/heinz-brandt', null, 'high']],
  'alpin-gebaeude': [['Andreas Gruber', 'Geschäftsführer (Owner)', 'a.gruber@alpin-gt.at', 'https://www.linkedin.com/in/andreas-gruber-gt', null, 'high']],
  'steirer-logistik': [['Franz Steiner', 'Eigentümer & GF', 'f.steiner@steirer-logistik.at', 'https://www.linkedin.com/in/franz-steiner-log', null, 'high']],
  'delft-aandrijf': [['Pieter van Dijk', 'Eigenaar / Directeur', 'p.vandijk@delft-aandrijf.nl', 'https://www.linkedin.com/in/pieter-van-dijk-drive', null, 'high']],
  'shannon-coldchain': [['Connor Walsh', 'Founder & MD', 'c.walsh@shannoncoldchain.ie', 'https://www.linkedin.com/in/connor-walsh-coldchain', null, 'high']],
};

function registryUrlFor(country, ref) {
  const reg = REGISTRY[country];
  if (!reg) return { registry: null, url: null };
  // For DE/AT refs we keep the official base (deep links aren't stable there).
  const url = /^https?:/.test(ref) ? ref : reg.base + ref;
  return { registry: reg.name, url };
}

async function insertCompany(client, row) {
  const [slug, name, sector, country, city, emp, revM, ebitdaM, own, founded, growth, heat, ownerAge, avail, ref, desc] = row;
  const { registry, url } = registryUrlFor(country, ref);
  const valuation = ebitdaM ? Math.round(ebitdaM * 6 * M) : null; // ~6x EBITDA indicative
  const r = await client.query(
    `INSERT INTO companies
       (slug, name, sector, country, hq_city, employees, revenue_eur, ebitda_eur,
        ownership, founded_year, growth_rate, sector_heat, owner_age, availability,
        valuation_eur, registry, registry_url, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [
      slug, name, sector, country, city, emp,
      Math.round(revM * M), Math.round(ebitdaM * M),
      own, founded, growth, heat, ownerAge, avail,
      valuation, registry, url, desc,
    ],
  );
  return r.rows[0]?.id || null;
}

async function insertAlerts(client, companyId, alerts) {
  for (const [type, severity, title, detail, source, sourceUrl, daysAgo] of alerts) {
    await client.query(
      `INSERT INTO alerts (company_id, type, severity, title, detail, source, source_url, signal_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() - ($8 || ' days')::interval)`,
      [companyId, type, severity, title, detail, source, sourceUrl, String(daysAgo)],
    );
  }
}

async function insertContacts(client, companyId, list) {
  const r = await client.query(`SELECT registry, registry_url FROM companies WHERE id = $1`, [companyId]);
  const reg = r.rows[0] || {};
  for (const [name, role, email, linkedin, personal, confidence] of list) {
    await client.query(
      `INSERT INTO contacts (company_id, name, role, email, linkedin_url, personal_email, source, source_url, confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [companyId, name, role, email, linkedin, personal, reg.registry || null, reg.registry_url || null, confidence],
    );
  }
}

module.exports = {
  name: 'seed_companies',
  up: async (client) => {
    for (const row of C) {
      const id = await insertCompany(client, row);
      if (id && A[row[0]]) await insertAlerts(client, id, A[row[0]]);
      if (id && CONTACTS[row[0]]) await insertContacts(client, id, CONTACTS[row[0]]);
    }
  },
};
