/**
 * Seed the monitored target universe + sourced M&A signals — FRANCE-FIRST.
 *
 * BildUp launches on the French lower-mid-market (French audience, French
 * targets), then expands: Benelux → Switzerland & Germany → Morocco & Italy.
 * The seed is France-dominant, with a few expansion-market previews. Every
 * company is tied to its official registry and every signal carries a
 * primary-source URL.
 *
 * Idempotent: companies key on `slug`; alerts/contacts only inserted on first
 * creation. Demo/reference data — registry/source URLs use the real official
 * domains to model the verifiability chain; live fetchers plug into
 * jobs/signal-monitor.js.
 */
const M = 1_000_000;

const REGISTRY = {
  France:      { name: 'Infogreffe / Pappers', base: 'https://www.pappers.fr/entreprise/' },
  Netherlands: { name: 'KVK', base: 'https://www.kvk.nl/zoeken/?q=' },
  Belgium:     { name: 'BCE / KBO', base: 'https://kbopub.economie.fgov.be/kbopub/zoekwoordenform.html?searchWord=' },
  Luxembourg:  { name: 'RCS Luxembourg', base: 'https://www.lbr.lu/' },
  Switzerland: { name: 'Zefix', base: 'https://www.zefix.ch/fr/search/entity/list?name=' },
  Germany:     { name: 'Handelsregister', base: 'https://www.handelsregister.de/rp_web/' },
};
const CFNEWS = 'https://www.cfnews.net/';
const BODACC = 'https://www.bodacc.fr/';

// slug, name, sector, country, city, employees, revenue(M€), ebitda(M€), ownership,
// founded, growth%, sector_heat, owner_age, availability, registryRef, description
const C = [
  // ---- France (marché de lancement) ---------------------------------------
  ['froid-atlantique', 'Froid Atlantique', 'Froid & Climatisation', 'France', 'Nantes', 64, 9.2, 1.4, 'owner-managed', 1996, 7, 84, 63, 'off-market', '498201634', 'Froid commercial : installation & maintenance pour la distribution alimentaire dans le grand Ouest. Contrats de service récurrents.'],
  ['clermont-usinage', 'Clermont Usinage', 'Industrie / Usinage', 'France', 'Clermont-Ferrand', 48, 7.1, 1.1, 'family-owned', 1984, 4, 58, 67, 'exploring', '402558190', 'Usinage de précision pour l\'aéronautique et l\'industrie. Fondateur proche de la retraite, sans successeur.'],
  ['proprenet-services', 'Propre-Net Services', 'Propreté B2B', 'France', 'Lyon', 210, 12.4, 1.6, 'owner-managed', 2001, 9, 71, 59, 'off-market', '441027885', 'Nettoyage de locaux B2B en Auvergne-Rhône-Alpes. Base de contrats diversifiée, faible churn.'],
  ['hydrowest', 'HydroWest', 'Traitement de l\'eau', 'France', 'Bordeaux', 38, 5.8, 1.0, 'founder-led', 2009, 14, 76, 55, 'exploring', '512339027', 'Systèmes de traitement de l\'eau industriels pour vignobles et agroalimentaire.'],
  ['logi-garonne', 'Logi-Garonne', 'Logistique & Transport', 'France', 'Toulouse', 95, 16.3, 1.3, 'family-owned', 1979, 3, 49, 69, 'rumoured', '317884520', 'Messagerie palettisée & entreposage régional. Deuxième génération en quête de sortie.'],
  ['vosges-metal', 'Vosges Métal', 'Industrie / Métallurgie', 'France', 'Épinal', 120, 18.5, 2.1, 'family-owned', 1972, 3, 55, 70, 'exploring', '395214770', 'Composants métalliques pour équipementiers. Succession ouverte, dirigeant 70 ans.'],
  ['mistral-levage', 'Mistral Levage', 'Ascenseurs / Maintenance', 'France', 'Marseille', 58, 7.6, 1.5, 'owner-managed', 1994, 6, 86, 64, 'off-market', '388470125', 'Maintenance & modernisation d\'ascenseurs, ~900 appareils sous contrat. Revenu récurrent collant.'],
  ['brettel-it', 'Brettel IT', 'Services informatiques (MSP)', 'France', 'Lille', 42, 5.4, 1.2, 'founder-led', 2011, 17, 85, 56, 'off-market', '529118742', 'Infogérance pour PME de services. 90 %+ de récurrent, forte rétention.'],
  ['veto-armor', 'Véto Armor', 'Services vétérinaires', 'France', 'Rennes', 70, 6.9, 1.4, 'family-owned', 1990, 8, 88, 66, 'rumoured', '344029186', 'Groupe vétérinaire 4 sites (animaux de compagnie). Intérêt consolidateur croissant.'],
  ['embal-loire', 'Embal Loire', 'Emballage / Carton', 'France', 'Saint-Étienne', 130, 17.8, 2.0, 'family-owned', 1977, 4, 56, 71, 'exploring', '309887541', 'Fabricant d\'emballages carton. Succession, dirigeant 71 ans.'],
  ['aqua-sud', 'Aqua Sud Environnement', 'Services environnementaux', 'France', 'Montpellier', 96, 13.1, 1.7, 'owner-managed', 1998, 7, 74, 62, 'exploring', '420559813', 'Services déchets & dépollution industriels pour le Sud.'],
  ['delice-traiteur', 'Délice Traiteur Pro', 'Foodservice / Traiteur', 'France', 'Lyon', 88, 9.7, 1.2, 'owner-managed', 2004, 10, 52, 60, 'off-market', '481026734', 'Traiteur événementiel & restauration collective B2B.'],

  // ---- Aperçu marchés d'expansion (Benelux / CH / DE) ---------------------
  ['delft-aandrijf', 'Delft Aandrijftechniek', 'Distribution B2B', 'Netherlands', 'Delft', 39, 7.9, 1.1, 'owner-managed', 1998, 8, 60, 61, 'exploring', 'delft-aandrijftechniek', 'Distributeur de composants d\'entraînement & automation. Clientèle industrielle fidèle.'],
  ['wallonie-froid', 'Wallonie Froid Industriel', 'Froid & Climatisation', 'Belgium', 'Liège', 52, 8.3, 1.3, 'family-owned', 1989, 6, 80, 67, 'exploring', 'wallonie-froid', 'Froid industriel & CVC pour l\'industrie wallonne. Cas de succession.'],
  ['lux-facility', 'Lux Facility Services', 'Facility management', 'Luxembourg', 'Luxembourg', 145, 14.6, 1.8, 'owner-managed', 2002, 9, 64, 58, 'off-market', '', 'Services multitechniques pour l\'immobilier tertiaire luxembourgeois.'],
  ['leman-technique', 'Léman Technique', 'Génie climatique', 'Switzerland', 'Genève', 60, 11.2, 1.9, 'family-owned', 1991, 5, 81, 66, 'exploring', 'leman-technique', 'Génie climatique pour l\'hôtellerie & le tertiaire lémanique. Succession ouverte.'],
  ['rheinluft-klima', 'Rheinluft Klimatechnik', 'Froid & Climatisation', 'Germany', 'Cologne', 78, 11.8, 1.9, 'family-owned', 1981, 5, 83, 68, 'exploring', 'HRB-rheinluft', 'CVC commercial pour le Mittelstand industriel. Cas de Nachfolge classique.'],
  ['saarmetall-werk', 'Saarmetall Werk', 'Industrie / Métallurgie', 'Germany', 'Saarbrücken', 165, 27.5, 3.1, 'family-owned', 1968, 2, 52, 70, 'rumoured', 'HRB-saarmetall', 'Composants métalliques pour l\'automobile tier-2. Succession + transformation.'],
];

// slug -> [type, severity, title, detail, sourceName, sourceUrl, daysAgo]
const A = {
  'froid-atlantique': [
    ['succession', 'high', 'Gérant 63 ans, sans successeur', 'Les données dirigeants montrent un gérant unique de 63 ans sans cession de parts déposée — fenêtre de succession typique.', 'Infogreffe / Pappers', 'https://www.pappers.fr/entreprise/froid-atlantique-498201634', 2],
    ['filing', 'medium', 'Comptes 2025 déposés — marge EBITDA 15 %', 'Derniers comptes publiés ; revenu de service stable, marges préservées.', 'Infogreffe / Pappers', 'https://www.pappers.fr/entreprise/froid-atlantique-498201634#comptes', 12],
  ],
  'clermont-usinage': [
    ['availability', 'high', 'Mandat conseil pressenti', 'Une boutique M&A régionale évoque un mandat « usinage aéronautique » correspondant à ce profil.', 'CFNEWS', CFNEWS + 'l-actualite/transactions/cessions-pme-aero-auvergne', 4],
    ['succession', 'medium', 'Fondateur 67 ans, familial', 'Détention familiale ancienne, fondateur de plus de 65 ans — exploration d\'une sortie.', 'Infogreffe / Pappers', 'https://www.pappers.fr/entreprise/clermont-usinage-402558190', 9],
  ],
  'proprenet-services': [
    ['market', 'medium', 'Consolidation de la propreté B2B', 'Deux plateformes sous LBO consolident la propreté B2B régionale — multiples qui se tendent.', 'CFNEWS', CFNEWS + 'l-actualite/build-up/proprete-b2b-consolidation', 6],
  ],
  'logi-garonne': [
    ['ownership', 'high', 'BODACC : avis de cession de parts', 'Le BODACC a publié un avis de cession partielle de parts — actionnariat en mouvement.', 'BODACC', BODACC + 'annonce/2026-A-12840', 3],
  ],
  'vosges-metal': [
    ['succession', 'high', 'Succession ouverte — dirigeant 70 ans', 'Détention familiale, dirigeant de 70 ans, aucun successeur identifié au RNE.', 'INPI / RNE', 'https://data.inpi.fr/entreprises/395214770', 2],
  ],
  'mistral-levage': [
    ['succession', 'high', '~900 ascenseurs sous contrat, gérant 64 ans', 'Base de maintenance récurrente avec un gérant proche de la retraite.', 'Infogreffe / Pappers', 'https://www.pappers.fr/entreprise/mistral-levage-388470125', 1],
  ],
  'brettel-it': [
    ['availability', 'high', 'MSP off-market, cédant ouvert', 'Gérant 56 ans ayant signalé une ouverture à la cession ; 90 %+ de revenu récurrent.', 'Infogreffe / Pappers', 'https://www.pappers.fr/entreprise/brettel-it-529118742', 2],
    ['market', 'medium', 'Roll-up MSP : multiples en hausse', 'Les plateformes MSP paient cher les bases récurrentes collantes.', 'CFNEWS', CFNEWS + 'l-actualite/build-up/msp-it-services', 11],
  ],
  'veto-armor': [
    ['deal', 'high', 'Consolidateur véto actif à proximité', 'Un consolidateur a clôturé une acquisition véto multi-sites adjacente — segment en jeu.', 'CFNEWS', CFNEWS + 'l-actualite/transactions/veterinaire-build-up', 3],
  ],
  'embal-loire': [
    ['succession', 'high', 'Dirigeant 71 ans — succession en retard', 'Détention familiale, dirigeant de 71 ans, aucun plan de succession déposé.', 'Infogreffe / Pappers', 'https://www.pappers.fr/entreprise/embal-loire-309887541', 5],
  ],
  'logi-garonne-deal': [],
  'wallonie-froid': [
    ['succession', 'medium', 'BCE : actionnariat familial, dirigeant 67 ans', 'La Banque-Carrefour montre une détention familiale au stade de succession.', 'BCE / KBO', 'https://kbopub.economie.fgov.be/kbopub/zoekwoordenform.html?searchWord=wallonie-froid', 5],
  ],
  'leman-technique': [
    ['market', 'medium', 'Génie climatique alpin recherché', 'Les actifs CVC accrédités sont rares et disputés sur l\'arc lémanique.', 'CFNEWS', CFNEWS + 'l-actualite/build-up/genie-climatique', 8],
  ],
  'rheinluft-klima': [
    ['succession', 'high', 'Nachfolge : dirigeant 68 ans, familial', 'Le Handelsregister montre une détention familiale ancienne ; dirigeant de 68 ans.', 'Handelsregister', 'https://www.handelsregister.de/rp_web/', 4],
  ],
  'saarmetall-werk': [
    ['deal', 'medium', 'Carve-outs automobiles tier-2 en accélération', 'Succession + transition EV poussent les équipementiers du Mittelstand à vendre.', 'CFNEWS', CFNEWS + 'l-actualite/transactions/mittelstand-automotive', 13],
  ],
};

// slug -> [name, role, email, linkedin, personal_email, confidence]
const CONTACTS = {
  'froid-atlantique': [['Jean-Marc Brèthes', 'Gérant & associé', 'jm.brethes@froid-atlantique.fr', 'https://www.linkedin.com/in/jean-marc-brethes', null, 'high']],
  'clermont-usinage': [['Bernard Faure', 'Président (fondateur)', 'b.faure@clermont-usinage.fr', 'https://www.linkedin.com/in/bernard-faure-usinage', null, 'high']],
  'proprenet-services': [['Sylvie Marchand', 'Gérante', 's.marchand@propre-net.fr', 'https://www.linkedin.com/in/sylvie-marchand-services', null, 'high']],
  'logi-garonne': [['Henri Lacombe', 'Président', 'h.lacombe@logi-garonne.fr', 'https://www.linkedin.com/in/henri-lacombe-logistique', null, 'high']],
  'vosges-metal': [['Gérard Munier', 'Président-directeur général', 'g.munier@vosges-metal.fr', 'https://www.linkedin.com/in/gerard-munier', null, 'high']],
  'mistral-levage': [['Antoine Rossi', 'Gérant & associé', 'a.rossi@mistral-levage.fr', 'https://www.linkedin.com/in/antoine-rossi-levage', null, 'high']],
  'brettel-it': [['David Lemaire', 'Fondateur & dirigeant', 'd.lemaire@brettel-it.fr', 'https://www.linkedin.com/in/david-lemaire-msp', null, 'high']],
  'veto-armor': [['Marguerite Le Goff', 'Associée principale', 'm.legoff@veto-armor.fr', 'https://www.linkedin.com/in/marguerite-le-goff-dmv', null, 'high']],
  'embal-loire': [['Roland Berthier', 'Président', 'r.berthier@embal-loire.fr', 'https://www.linkedin.com/in/roland-berthier-emballage', null, 'high']],
  'rheinluft-klima': [['Klaus Hofmann', 'Geschäftsführer (Owner)', 'k.hofmann@rheinluft.de', 'https://www.linkedin.com/in/klaus-hofmann-klima', null, 'high']],
};

function registryUrlFor(country, ref) {
  const reg = REGISTRY[country];
  if (!reg) return { registry: null, url: null };
  const url = !ref ? reg.base : /^https?:/.test(ref) ? ref : reg.base + ref;
  return { registry: reg.name, url };
}

async function insertCompany(client, row) {
  const [slug, name, sector, country, city, emp, revM, ebitdaM, own, founded, growth, heat, ownerAge, avail, ref, desc] = row;
  const { registry, url } = registryUrlFor(country, ref);
  const valuation = ebitdaM ? Math.round(ebitdaM * 6 * M) : null;
  const r = await client.query(
    `INSERT INTO companies
       (slug, name, sector, country, hq_city, employees, revenue_eur, ebitda_eur,
        ownership, founded_year, growth_rate, sector_heat, owner_age, availability,
        valuation_eur, registry, registry_url, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [slug, name, sector, country, city, emp, Math.round(revM * M), Math.round(ebitdaM * M),
     own, founded, growth, heat, ownerAge, avail, valuation, registry, url, desc],
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
      if (id && A[row[0]] && A[row[0]].length) await insertAlerts(client, id, A[row[0]]);
      if (id && CONTACTS[row[0]]) await insertContacts(client, id, CONTACTS[row[0]]);
    }
  },
};
