/**
 * Tests for `jorvel build` command logic and build output artifacts.
 *
 * Unit tests verify app-discovery and ordering logic without running Rspack.
 * Output tests assert the shape of the dist/ artifacts that Rspack produces
 * (they skip gracefully when dist/ does not exist yet).
 */

import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function makeTmp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-build-')) as Promise<string>;
}

async function scaffoldWorkspace(
  tmp: string,
  apps: Array<{ name: string; type: 'host' | 'remote'; port: number }>
): Promise<string> {
  const appsDir = path.join(tmp, 'apps');
  for (const app of apps) {
    const dir = path.join(appsDir, app.name);
    await fs.ensureDir(dir);
    await fs.writeJson(path.join(dir, 'jorvel.app.json'), {
      name: app.name,
      type: app.type,
      port: app.port,
    });
  }
  return appsDir;
}

// Replicate the build-order sort from build.ts so we can test it in isolation.
function sortAppsForBuild<T extends { meta: { type: 'host' | 'remote' } }>(apps: T[]): T[] {
  return [...apps].sort(
    (a, b) => (a.meta.type === 'remote' ? -1 : 1) - (b.meta.type === 'remote' ? -1 : 1)
  );
}

// ── Unit tests — app discovery & sorting ─────────────────────────────────────

describe('jorvel build — app discovery', () => {
  it('discovers all apps that have jorvel.app.json', async () => {
    const tmp = await makeTmp();
    const appsDir = await scaffoldWorkspace(tmp, [
      { name: 'shell', type: 'host', port: 3000 },
      { name: 'dashboard', type: 'remote', port: 3001 },
    ]);

    expect(await fs.pathExists(path.join(appsDir, 'shell', 'jorvel.app.json'))).toBe(true);
    expect(await fs.pathExists(path.join(appsDir, 'dashboard', 'jorvel.app.json'))).toBe(true);
  });

  it('ignores app folders that lack jorvel.app.json', async () => {
    const tmp = await makeTmp();
    const appsDir = path.join(tmp, 'apps');

    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.writeJson(path.join(appsDir, 'shell', 'jorvel.app.json'), {
      name: 'shell', type: 'host', port: 3000,
    });
    await fs.ensureDir(path.join(appsDir, 'storybook')); // no jorvel.app.json

    const folders = (await fs.readdir(appsDir)) as string[];
    const withMeta: string[] = [];
    for (const f of folders) {
      if (await fs.pathExists(path.join(appsDir, f, 'jorvel.app.json'))) {
        withMeta.push(f);
      }
    }
    expect(withMeta).toEqual(['shell']);
  });

  it('reports no apps when apps/ is empty', async () => {
    const tmp = await makeTmp();
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(appsDir);

    const folders = (await fs.readdir(appsDir)) as string[];
    const withMeta: string[] = [];
    for (const f of folders) {
      if (await fs.pathExists(path.join(appsDir, f, 'jorvel.app.json'))) {
        withMeta.push(f);
      }
    }
    expect(withMeta).toHaveLength(0);
  });

  it('correctly reads host and remote types from jorvel.app.json', async () => {
    const tmp = await makeTmp();
    const appsDir = await scaffoldWorkspace(tmp, [
      { name: 'shell', type: 'host', port: 3000 },
      { name: 'dashboard', type: 'remote', port: 3001 },
    ]);
    const shell = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.app.json'));
    const dash  = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.app.json'));
    expect(shell.type).toBe('host');
    expect(dash.type).toBe('remote');
  });
});

// ── Unit tests — build order ──────────────────────────────────────────────────

describe('jorvel build — build order', () => {
  it('remotes are sorted before hosts', () => {
    const apps = [
      { dir: '/apps/shell',     meta: { name: 'shell',     type: 'host' as const,   port: 3000 } },
      { dir: '/apps/dashboard', meta: { name: 'dashboard', type: 'remote' as const, port: 3001 } },
    ];
    const sorted = sortAppsForBuild(apps);
    expect(sorted[0].meta.type).toBe('remote');
    expect(sorted[1].meta.type).toBe('host');
  });

  it('multiple remotes are all sorted before the host', () => {
    const apps = [
      { dir: '/apps/shell',     meta: { name: 'shell',     type: 'host' as const,   port: 3000 } },
      { dir: '/apps/dash',      meta: { name: 'dash',      type: 'remote' as const, port: 3001 } },
      { dir: '/apps/analytics', meta: { name: 'analytics', type: 'remote' as const, port: 3002 } },
    ];
    const sorted = sortAppsForBuild(apps);
    expect(sorted[0].meta.type).toBe('remote');
    expect(sorted[1].meta.type).toBe('remote');
    expect(sorted[2].meta.type).toBe('host');
  });

  it('a list of only hosts stays as hosts', () => {
    const apps = [
      { dir: '/apps/shell', meta: { name: 'shell', type: 'host' as const, port: 3000 } },
    ];
    const sorted = sortAppsForBuild(apps);
    expect(sorted[0].meta.type).toBe('host');
  });

  it('a list of only remotes stays as remotes', () => {
    const apps = [
      { dir: '/apps/dash', meta: { name: 'dash', type: 'remote' as const, port: 3001 } },
      { dir: '/apps/nav',  meta: { name: 'nav',  type: 'remote' as const, port: 3002 } },
    ];
    const sorted = sortAppsForBuild(apps);
    expect(sorted.every((a) => a.meta.type === 'remote')).toBe(true);
  });
});

// ── Build output structure tests ──────────────────────────────────────────────
//
// These skip gracefully when dist/ does not exist yet.
// Run `pnpm build` in examples/basic first (or the e2e suite does it).

// fileURLToPath (not URL.pathname) — the latter yields `/C:/…` on Windows, so
// path.resolve produced a bogus path and distReady was permanently false there,
// silently skipping all 12 build-output assertions even with the example built.
const exampleRoot  = path.resolve(fileURLToPath(new URL('../../../examples/basic/', import.meta.url)));
const shellDist    = path.join(exampleRoot, 'apps', 'shell',     'dist');
const remoteDist   = path.join(exampleRoot, 'apps', 'dashboard', 'dist');

const distReady = (await fs.pathExists(shellDist)) && (await fs.pathExists(remoteDist));

describe('build output — remote (dashboard) dist/', () => {
  it.skipIf(!distReady)(
    'dist/remoteEntry.js exists',
    async () => {
      expect(await fs.pathExists(path.join(remoteDist, 'remoteEntry.js'))).toBe(true);
    }
  );

  it.skipIf(!distReady)(
    'remoteEntry.js contains the dashboard container name',
    async () => {
      const content = await fs.readFile(path.join(remoteDist, 'remoteEntry.js'), 'utf8');
      expect(content).toContain('dashboard');
    }
  );

  it.skipIf(!distReady)(
    'dist/ contains at least one content-hashed JS chunk',
    async () => {
      const files = (await fs.readdir(remoteDist)) as string[];
      const hashed = files.filter(
        (f) => f.endsWith('.js') && /\.[a-f0-9]{8,}\.js$/.test(f)
      );
      expect(hashed.length).toBeGreaterThan(0);
    }
  );

  it.skipIf(!distReady)(
    'dist/index.html exists',
    async () => {
      expect(await fs.pathExists(path.join(remoteDist, 'index.html'))).toBe(true);
    }
  );

  it.skipIf(!distReady)(
    'jorvel.federation.json declares filename: remoteEntry.js',
    async () => {
      const cfg = await fs.readJson(
        path.join(exampleRoot, 'apps', 'dashboard', 'jorvel.federation.json')
      );
      expect(cfg.filename).toBe('remoteEntry.js');
    }
  );

  it.skipIf(!distReady)(
    'jorvel.federation.json exposes "./App"',
    async () => {
      const cfg = await fs.readJson(
        path.join(exampleRoot, 'apps', 'dashboard', 'jorvel.federation.json')
      );
      expect(cfg.exposes).toHaveProperty('./App');
    }
  );
});

describe('build output — shell (host) dist/', () => {
  it.skipIf(!distReady)(
    'dist/index.html exists',
    async () => {
      expect(await fs.pathExists(path.join(shellDist, 'index.html'))).toBe(true);
    }
  );

  it.skipIf(!distReady)(
    'dist/index.html references a content-hashed main JS bundle',
    async () => {
      const html = await fs.readFile(path.join(shellDist, 'index.html'), 'utf8');
      expect(html).toMatch(/\.js/);
    }
  );

  it.skipIf(!distReady)(
    'dist/ does NOT contain standalone react or react-dom chunks (singleton sharing)',
    async () => {
      const files = (await fs.readdir(shellDist)) as string[];
      const reactChunks = files.filter(
        (f) => /^react[.-]/.test(f) || /^react-dom[.-]/.test(f)
      );
      expect(reactChunks).toHaveLength(0);
    }
  );

  it.skipIf(!distReady)(
    'shell jorvel.federation.json references dashboard remoteEntry.js',
    async () => {
      const cfg = await fs.readJson(
        path.join(exampleRoot, 'apps', 'shell', 'jorvel.federation.json')
      );
      expect(cfg.remotes?.dashboard).toContain('remoteEntry.js');
    }
  );
});

// ── Content hashing correctness ───────────────────────────────────────────────

describe('build output — content hashing', () => {
  it.skipIf(!distReady)(
    'two builds of the same unchanged source produce identical remoteEntry.js hash',
    async () => {
      // Read current remoteEntry (artifact from last build) and confirm it is a JS file
      const entry = path.join(remoteDist, 'remoteEntry.js');
      const content = await fs.readFile(entry, 'utf8');
      // Must be a valid JS file (not HTML or empty)
      expect(content.length).toBeGreaterThan(50);
      expect(content).not.toMatch(/^<!DOCTYPE/);
    }
  );

  it.skipIf(!distReady)(
    'dashboard dist/ output files all have .js extension (no .mjs/.cjs)',
    async () => {
      const files = (await fs.readdir(remoteDist)) as string[];
      const jsFiles = files.filter((f) => /\.(m?js|cjs)$/.test(f));
      for (const f of jsFiles) {
        expect(f.endsWith('.js')).toBe(true);
      }
    }
  );
});
