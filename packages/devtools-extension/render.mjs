// @ts-check
/**
 * Pure rendering for the JORVEL devtools panel. Takes a `window.__JORVEL__`
 * snapshot and returns HTML. Kept dependency-free + side-effect-free so it runs
 * both in the extension panel and under vitest.
 *
 * Snapshot shape (from @jorvel/runtime devtools):
 *   { version, remotes: { name: { entryUrl, loadedAtMs, integrity? } },
 *     shareScope: Record<string, unknown> | null,
 *     timings: [{ name, durationMs, ts }] }
 */

/** @param {unknown} s */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

/** @param {any} snapshot */
export function renderSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return '<p class="empty">No JORVEL runtime detected on this page. (window.__JORVEL__ is absent.)</p>';
  }
  const remotes = snapshot.remotes && typeof snapshot.remotes === 'object' ? snapshot.remotes : {};
  const timings = Array.isArray(snapshot.timings) ? snapshot.timings : [];
  const shareScope = snapshot.shareScope && typeof snapshot.shareScope === 'object' ? snapshot.shareScope : {};

  const remoteRows = Object.entries(remotes)
    .map(
      ([name, r]) =>
        `<tr><td>${escapeHtml(name)}</td>` +
        `<td class="mono">${escapeHtml(/** @type {any} */ (r).entryUrl ?? '')}</td>` +
        `<td>${/** @type {any} */ (r).integrity ? '✓' : '—'}</td>` +
        `<td>${escapeHtml(fmtTime(/** @type {any} */ (r).loadedAtMs))}</td></tr>`,
    )
    .join('');

  const timingRows = timings
    .slice(-50)
    .reverse()
    .map(
      (/** @type {any} */ t) =>
        `<tr><td>${escapeHtml(t.name)}</td><td>${escapeHtml(Math.round(t.durationMs))}ms</td></tr>`,
    )
    .join('');

  const shareKeys = Object.keys(shareScope);

  return [
    `<header><strong>JORVEL</strong> <span class="ver">v${escapeHtml(snapshot.version ?? '?')}</span>`,
    `<span class="count">${Object.keys(remotes).length} remotes · ${timings.length} loads</span></header>`,
    `<h2>Remotes</h2>`,
    Object.keys(remotes).length
      ? `<table><thead><tr><th>Name</th><th>Entry URL</th><th>SRI</th><th>Loaded</th></tr></thead><tbody>${remoteRows}</tbody></table>`
      : '<p class="empty">No remotes loaded yet.</p>',
    `<h2>Load timings</h2>`,
    timings.length
      ? `<table><thead><tr><th>Remote</th><th>Duration</th></tr></thead><tbody>${timingRows}</tbody></table>`
      : '<p class="empty">No timings recorded.</p>',
    `<h2>Share scope</h2>`,
    shareKeys.length
      ? `<p class="mono">${shareKeys.map(escapeHtml).join(', ')}</p>`
      : '<p class="empty">Share scope empty or unavailable.</p>',
  ].join('\n');
}

/** @param {number|undefined} ms */
function fmtTime(ms) {
  if (typeof ms !== 'number') return '—';
  try {
    return new Date(ms).toLocaleTimeString();
  } catch {
    return String(ms);
  }
}
