/**
 * View formatting helpers. Exposed to every EJS template as `fmt`
 * (wired via app.locals in server.js).
 */
function eur(n) {
  if (n == null || n === '') return '—';
  const m = Number(n) / 1_000_000;
  if (!isFinite(m)) return '—';
  if (m >= 1000) return `€${(m / 1000).toFixed(1)}B`;
  if (m >= 10) return `€${Math.round(m)}M`;
  if (m >= 1) return `€${m.toFixed(1)}M`;
  return `€${Math.round(Number(n) / 1000)}K`;
}

function num(n) {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString('en-US');
}

function timeAgo(date) {
  if (!date) return '';
  const then = new Date(date).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function title(s) {
  if (!s) return '';
  return String(s).replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** CSS modifier for a severity / band value. */
function sev(level) {
  return String(level || '').toLowerCase();
}

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

module.exports = { eur, num, timeAgo, title, sev, escapeHtml, mdLite };
