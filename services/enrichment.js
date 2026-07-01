/**
 * Contact enrichment.
 *
 * Returns the key people to approach for a target (owner / MD / FD), and
 * defines the seam where a real enrichment provider plugs in.
 *
 * Sourcing model (mirrors the verifiability promise):
 *   - Identity + role come from the official registry officers list
 *     (Companies House, Infogreffe, Handelsregister, Firmenbuch, KVK, CRO) —
 *     these are public, lawful-basis-clean facts about company officers.
 *   - Work email is an inferred business-domain pattern (clearly flagged).
 *   - LinkedIn / personal email / phone are ENRICHMENT fields populated by a
 *     pluggable provider (e.g. Companies House officers API + a B2B contact
 *     provider such as Hunter, Apollo, or People Data Labs).
 *
 * GDPR / compliance note: contact data on real individuals must have a lawful
 * basis (legitimate interest for B2B outreach) and honour erasure requests.
 * `personal_email` and `phone` are intentionally separate, higher-sensitivity
 * fields. This module exposes the integration point but does NOT itself scrape
 * personal data — wire a compliant provider into `enrichContact` and supply
 * the relevant API key. Without a provider, only registry-sourced people +
 * inferred work emails are returned.
 */
const contacts = require('../db/contacts');

const ENRICH_PROVIDER = process.env.CONTACT_ENRICH_PROVIDER || null; // e.g. 'apollo' | 'pdl' | 'hunter'

/** A best-effort placeholder when no contact record exists yet. */
function inferredOwner(company) {
  return {
    company_id: company.id,
    name: 'Principal / Managing Director',
    role: 'Owner',
    email: null,
    linkedin_url: null,
    personal_email: null,
    phone: null,
    source: company.registry || 'Registry officers',
    source_url: company.registry_url || null,
    confidence: 'pending',
    inferred: true,
  };
}

/**
 * Enrich a single contact with a third-party provider. No-op unless a provider
 * + key is configured. This is the ONLY place live personal-data lookups should
 * happen, behind an explicit, compliant provider integration.
 */
async function enrichContact(contact) {
  if (!ENRICH_PROVIDER) return contact; // no provider configured → return as-is
  // Integration point — wire the chosen provider here, e.g.:
  //   const found = await provider.find({ name: contact.name, company, linkedin: contact.linkedin_url });
  //   return { ...contact, personal_email: found.personalEmail, phone: found.phone, confidence: 'verified' };
  return contact;
}

/** Key people for a company. Falls back to an inferred owner when empty. */
async function getContacts(company) {
  const rows = await contacts.forCompany(company.id);
  const list = rows.length ? rows : [inferredOwner(company)];
  return Promise.all(list.map(enrichContact));
}

module.exports = { getContacts, enrichContact };
