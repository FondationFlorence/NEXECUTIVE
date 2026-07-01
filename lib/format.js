/**
 * View formatting helpers. Exposed to every EJS template as `fmt`
 * (wired via app.locals in server.js). French-first product UI.
 *
 * Enum *keys* stay English (they drive CSS modifiers and DB values); the
 * `country/availability/ownership/alertType/severity/band/stage` helpers map
 * those keys to French display labels. Seed data (sectors, names, signal copy)
 * is already French, so it is rendered as-is.
 */
function eur(n) {
  if (n == null || n === '') return '—';
  const m = Number(n) / 1_000_000;
  if (!isFinite(m)) return '—';
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace('.', ',')} Md€`;
  if (m >= 10) return `${Math.round(m)} M€`;
  if (m >= 1) return `${m.toFixed(1).replace('.', ',')} M€`;
  return `${Math.round(Number(n) / 1000)} k€`;
}

function num(n) {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString('fr-FR');
}

function timeAgo(date) {
  if (!date) return '';
  const then = new Date(date).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'à l’instant';
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function title(s) {
  if (!s) return '';
  return String(s).replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** CSS modifier for a severity / band value. */
function sev(level) {
  return String(level || '').toLowerCase();
}

// ---- French display labels for English enum keys --------------------------

const COUNTRY_FR = {
  France: 'France', Netherlands: 'Pays-Bas', Belgium: 'Belgique',
  Luxembourg: 'Luxembourg', Switzerland: 'Suisse', Germany: 'Allemagne',
  Morocco: 'Maroc', Italy: 'Italie', Austria: 'Autriche',
  'United Kingdom': 'Royaume-Uni', Ireland: 'Irlande',
};

const AVAILABILITY_FR = {
  'for-sale': 'À vendre', exploring: 'En réflexion',
  rumoured: 'Rumeur', 'off-market': 'Hors-marché',
};

const OWNERSHIP_FR = {
  'owner-managed': 'Dirigée par le propriétaire', 'family-owned': 'Familiale',
  'founder-led': 'Dirigée par le fondateur', private: 'Privée',
};

const ALERT_TYPE_FR = {
  succession: 'Succession', filing: 'Dépôt de comptes', availability: 'Disponibilité',
  market: 'Marché', ownership: 'Cession', deal: 'Opération', regulatory: 'Réglementaire',
};

const SEVERITY_FR = { high: 'Élevé', medium: 'Moyen', low: 'Faible' };

const BAND_FR = { Hot: 'Chaud', Warm: 'Tiède', Watch: 'À suivre', Cold: 'Froid' };

const STAGE_FR = {
  sourced: 'Sourcé', screening: 'Qualification', diligence: 'Due diligence',
  term_sheet: 'Term sheet', closed: 'Conclu', passed: 'Écarté',
};

const lookup = (map) => (v) => map[v] ?? map[String(v).toLowerCase()] ?? title(v);

const country = lookup(COUNTRY_FR);
const availability = lookup(AVAILABILITY_FR);
const ownership = lookup(OWNERSHIP_FR);
const alertType = lookup(ALERT_TYPE_FR);
const severity = lookup(SEVERITY_FR);
const stage = lookup(STAGE_FR);
const band = (v) => BAND_FR[v] ?? title(v);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Minimal, dependency-free Markdown -> HTML for rendering deal briefs.
 *  Supports #/## headings, **bold**, *italic*, `code`, and - bullet lists. */
function mdLite(text) {
  const lines = escapeHtml(text || '').split(/\r?\n/);
  const inline = (s) =>
    s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
     .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
     .replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
     .replace(/`([^`]+?)`/g, '<code>$1</code>');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^##\s+/.test(line)) { closeList(); html += `<h3>${inline(line.replace(/^##\s+/, ''))}</h3>`; }
    else if (/^#\s+/.test(line)) { closeList(); html += `<h2>${inline(line.replace(/^#\s+/, ''))}</h2>`; }
    else if (/^[-*]\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`; }
    else if (line === '') { closeList(); }
    else { closeList(); html += `<p>${inline(line)}</p>`; }
  }
  closeList();
  return html;
}

module.exports = {
  eur, num, timeAgo, title, sev, escapeHtml, mdLite,
  country, availability, ownership, alertType, severity, band, stage,
};
