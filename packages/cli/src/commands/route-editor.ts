/**
 * `jorvel route-editor` — emits a single self-contained HTML file that lets
 * users drag remotes onto a route tree and export an `jorvel.routes.host.json`
 * (or `jorvel.routes.host.json`) update.
 *
 * The transform layer is pure JS — testable without a browser. The HTML
 * shell embeds the same transform code so the editor and the CLI stay in sync.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import { findHostApp } from '../discovery.js';
import kleur from 'kleur';

export interface HostRouteEntry {
  /** URL prefix (e.g. `/dashboard/*`). */
  path: string;
  /** Remote name as in `jorvel.federation.json#remotes`. */
  remote: string;
  /** Exposed module. Default: `'./App'`. */
  module?: string;
}

export interface HostRoutesManifest {
  routes: HostRouteEntry[];
}

export interface TreeNode {
  /** URL segment, possibly empty for the root. */
  segment: string;
  /** Full path so the UI can show it without re-computing. */
  fullPath: string;
  /** Remote that owns this path (when this node terminates a route). */
  remote?: string;
  /** Module exposed by the remote. */
  module?: string;
  children: TreeNode[];
}

function segmentsFor(path: string): string[] {
  return path
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter(Boolean);
}

/** Convert a flat manifest into a hierarchical tree (CLI side). */
export function manifestToTree(manifest: HostRoutesManifest): TreeNode {
  const root: TreeNode = { segment: '', fullPath: '/', children: [] };
  for (const entry of manifest.routes) {
    const segs = segmentsFor(entry.path);
    let node = root;
    let acc = '';
    if (segs.length === 0) {
      node.remote = entry.remote;
      if (entry.module !== undefined) node.module = entry.module;
      continue;
    }
    for (const seg of segs) {
      acc += '/' + seg;
      let child = node.children.find((c) => c.segment === seg);
      if (!child) {
        child = { segment: seg, fullPath: acc, children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.remote = entry.remote;
    if (entry.module !== undefined) node.module = entry.module;
  }
  return root;
}

/** Inverse — flatten the tree back to manifest form. Stable order. */
export function treeToManifest(tree: TreeNode): HostRoutesManifest {
  const routes: HostRouteEntry[] = [];
  const visit = (node: TreeNode) => {
    if (node.remote) {
      const entry: HostRouteEntry = { path: node.fullPath, remote: node.remote };
      if (node.module !== undefined) entry.module = node.module;
      routes.push(entry);
    }
    for (const c of [...node.children].sort((a, b) => a.segment.localeCompare(b.segment))) {
      visit(c);
    }
  };
  visit(tree);
  return { routes };
}

/** Apply one drag-drop operation: move a (path, remote) pair to a new parent. */
export interface MoveOperation {
  /** Path of the route to move. */
  fromPath: string;
  /** Path of the new parent (must already exist in the tree). */
  toParentPath: string;
}

export function moveRoute(manifest: HostRoutesManifest, op: MoveOperation): HostRoutesManifest {
  const idx = manifest.routes.findIndex((r) => r.path === op.fromPath);
  if (idx === -1) throw new Error(`route not found: ${op.fromPath}`);
  const target = manifest.routes[idx]!;
  const newParent = op.toParentPath === '/' ? '' : op.toParentPath.replace(/\/+$/, '');
  const oldSegs = segmentsFor(target.path);
  const newSegs = [...segmentsFor(newParent), oldSegs[oldSegs.length - 1] ?? ''];
  const newPath = '/' + newSegs.filter(Boolean).join('/');
  const next = manifest.routes.slice();
  next[idx] = { ...target, path: newPath || '/' };
  return { routes: next };
}

/** Build the HTML editor as a self-contained string. */
export function buildEditorHtml(initial: HostRoutesManifest): string {
  const data = JSON.stringify(initial, null, 2);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>jorvel · route editor</title>
  <style>
    body { font: 14px system-ui, sans-serif; padding: 24px; background: #0c0d10; color: #ddd }
    h1 { margin: 0 0 12px; font-weight: 600 }
    main { display: grid; grid-template-columns: 1fr 1fr; gap: 16px }
    .panel { background: #15171c; border: 1px solid #2a2d34; border-radius: 8px; padding: 12px }
    .row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 6px; cursor: grab }
    .row:hover { background: #1f232b }
    .row[draggable="true"] { user-select: none }
    .drop { min-height: 28px; border: 1px dashed #444; border-radius: 6px; padding: 4px }
    .drop.over { border-color: #6cf; background: #1f232b }
    pre { background: #0a0b0e; padding: 12px; border-radius: 6px; overflow: auto; max-height: 400px }
    button { background: #2a2d34; color: #ddd; border: 0; padding: 6px 12px; border-radius: 4px; cursor: pointer }
    button:hover { background: #3a3d44 }
    code { color: #6cf }
  </style>
</head>
<body>
  <h1>jorvel · route editor</h1>
  <p>Drag a route onto a parent to re-parent it. Copy the JSON when you're done.</p>
  <main>
    <section class="panel">
      <h2>Tree</h2>
      <div id="tree"></div>
    </section>
    <section class="panel">
      <h2>Manifest</h2>
      <pre id="json"></pre>
      <button id="copy">Copy JSON</button>
    </section>
  </main>
  <script>
    const segmentsFor = (p) => p.replace(/^\\/+/, '').replace(/\\/+$/, '').split('/').filter(Boolean);
    let manifest = ${data};

    function render() {
      const root = document.getElementById('tree');
      root.innerHTML = '';
      const groups = {};
      for (const r of manifest.routes) {
        const segs = segmentsFor(r.path);
        const parent = '/' + segs.slice(0, -1).join('/');
        (groups[parent] || (groups[parent] = [])).push(r);
      }
      const drawDrop = (parent, host) => {
        const drop = document.createElement('div');
        drop.className = 'drop';
        drop.dataset.parent = parent;
        drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
        drop.ondragleave = () => drop.classList.remove('over');
        drop.ondrop = (e) => {
          drop.classList.remove('over');
          const fromPath = e.dataTransfer.getData('text/plain');
          if (!fromPath) return;
          move(fromPath, parent);
        };
        host.appendChild(drop);
        for (const r of (groups[parent] || [])) {
          const row = document.createElement('div');
          row.className = 'row';
          row.draggable = true;
          row.textContent = r.path + '  →  ' + r.remote + (r.module ? '/' + r.module : '');
          row.ondragstart = (e) => e.dataTransfer.setData('text/plain', r.path);
          drop.appendChild(row);
        }
      };
      drawDrop('/', root);
      document.getElementById('json').textContent = JSON.stringify(manifest, null, 2);
    }

    function move(fromPath, toParent) {
      const idx = manifest.routes.findIndex((r) => r.path === fromPath);
      if (idx === -1) return;
      const segs = segmentsFor(fromPath);
      const leaf = segs[segs.length - 1] || '';
      const parentSegs = segmentsFor(toParent);
      const newPath = '/' + [...parentSegs, leaf].filter(Boolean).join('/');
      manifest.routes[idx] = { ...manifest.routes[idx], path: newPath || '/' };
      render();
    }

    document.getElementById('copy').onclick = () => {
      navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
    };
    render();
  </script>
</body>
</html>
`;
}

export interface RouteEditorScaffoldOptions {
  cwd: string;
  manifest?: string;
  out?: string;
  force?: boolean;
}

/**
 * Locate the host's route manifest without hardcoding `apps/shell`. Falls back
 * to `apps/shell/jorvel.routes.host.json` when no host app is discoverable
 * (e.g. an empty workspace) so the editor still scaffolds against a sane path.
 */
async function defaultHostManifestPath(cwd: string): Promise<string> {
  try {
    const host = await findHostApp(cwd);
    if (host) return path.join(host.dir, 'jorvel.routes.host.json');
  } catch {
    /* multiple-hosts or read error — fall through to the default */
  }
  return path.resolve(cwd, path.join('apps', 'shell', 'jorvel.routes.host.json'));
}

export async function scaffoldRouteEditor(opts: RouteEditorScaffoldOptions): Promise<{
  htmlPath: string;
  manifest: HostRoutesManifest;
  written: boolean;
}> {
  const cwd = path.resolve(opts.cwd);
  const manifestPath = opts.manifest
    ? path.resolve(cwd, opts.manifest)
    : await defaultHostManifestPath(cwd);
  let manifest: HostRoutesManifest = { routes: [] };
  if (await fs.pathExists(manifestPath)) {
    manifest = (await fs.readJson(manifestPath)) as HostRoutesManifest;
  }
  const htmlPath = path.resolve(cwd, opts.out ?? 'route-editor.html');
  if ((await fs.pathExists(htmlPath)) && !opts.force) {
    return { htmlPath, manifest, written: false };
  }
  await fs.writeFile(htmlPath, buildEditorHtml(manifest), 'utf8');
  return { htmlPath, manifest, written: true };
}

export const routeEditorCommand = new Command('route-editor')
  .description('Open a self-contained HTML route editor for the host manifest.')
  .option('--manifest <file>', 'Path to the host routes manifest (relative to cwd or absolute)')
  .option('--out <file>', 'Path to write the HTML editor (default: route-editor.html)')
  .option('--cwd <dir>', 'Workspace root', process.cwd())
  .option('--force', 'Overwrite an existing editor file', false)
  .action(async (opts: RouteEditorScaffoldOptions) => {
    const runOpts: RouteEditorScaffoldOptions = { cwd: opts.cwd ?? process.cwd() };
    if (opts.manifest !== undefined) runOpts.manifest = opts.manifest;
    if (opts.out !== undefined) runOpts.out = opts.out;
    if (opts.force !== undefined) runOpts.force = opts.force;
    const r = await scaffoldRouteEditor(runOpts);
    if (!r.written) {
      console.log(kleur.yellow(`skip — ${path.relative(process.cwd(), r.htmlPath)} exists (use --force)`));
      return;
    }
    console.log(kleur.green(`wrote ${path.relative(process.cwd(), r.htmlPath)}`));
    console.log(kleur.dim(`open with: file://${r.htmlPath.replace(/\\/g, '/')}`));
  });
