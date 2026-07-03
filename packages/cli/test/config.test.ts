import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { loadWorkspaceConfig } from '../src/config';

async function mkTmpDir(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function write(p: string, content: string) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, 'utf8');
}

describe('loadWorkspaceConfig', () => {
  it('loads jorvel.config.json when present', async () => {
    const dir = await mkTmpDir('jorvel-config-json-');

    await write(
      path.join(dir, 'jorvel.config.json'),
      JSON.stringify(
        {
          name: 'json-only',
          features: { tailwind: true },
          orchestrator: { mode: 'on-demand' },
        },
        null,
        2
      )
    );

    const { cfg, plugins } = await loadWorkspaceConfig(dir);
    expect(cfg.name).toBe('json-only');
    expect(cfg.features?.tailwind).toBe(true);
    expect(cfg.orchestrator?.mode).toBe('on-demand');
    expect(plugins).toEqual([]);
  });

  it('loads jorvel.config.ts when a compiled .js sibling is present, and merges with JSON', async () => {
    const dir = await mkTmpDir('jorvel-config-ts-');

    await write(
      path.join(dir, 'jorvel.config.json'),
      JSON.stringify(
        {
          name: 'base',
          orchestrator: { mode: 'on-demand' },
          federation: { shared: ['react'] },
        },
        null,
        2,
      ),
    );

    // The CLI no longer imports raw .ts; ship a compiled .js sibling. The
    // marker .ts is kept to verify the loader picks the .js up.
    await write(path.join(dir, 'jorvel.config.ts'), '// source\n');
    await write(
      path.join(dir, 'jorvel.config.js'),
      [
        "const plugin = { name: 'p1', configResolved: (cfg) => ({ ...cfg, name: 'from-ts' }) };",
        'export default {',
        "  name: 'ts',",
        "  orchestrator: { mode: 'parallel', proxyRemotes: true },",
        "  federation: { shared: ['react-dom'] },",
        '  plugins: [plugin],',
        '};',
        '',
      ].join('\n'),
    );

    const { cfg, plugins } = await loadWorkspaceConfig(dir);

    // plugin should have run via configResolved
    expect(cfg.name).toBe('from-ts');

    // values from TS should override JSON due to merge order
    expect(cfg.orchestrator?.mode).toBe('parallel');
    expect(cfg.orchestrator?.proxyRemotes).toBe(true);

    // arrays currently override (not deep-merged)
    expect(cfg.federation?.shared).toEqual(['react-dom']);

    expect(plugins.map((p) => p.name)).toEqual(['p1']);
  });

  it('skips (does not throw on) a jorvel.config.ts with no compiled .js sibling', async () => {
    // `jorvel init` ships jorvel.config.json alongside an optional typed .ts;
    // the CLI cannot import raw .ts at runtime, so an unaccompanied .ts must be
    // a no-op rather than a hard CONFIG-002 throw (which broke every command in
    // a freshly-init'd workspace).
    const dir = await mkTmpDir('jorvel-config-badts-');

    await write(
      path.join(dir, 'jorvel.config.ts'),
      'export default (this is not valid ts);\n',
    );

    const { cfg } = await loadWorkspaceConfig(dir);
    expect(cfg).toEqual({});
  });

  it('still loads jorvel.config.json even when an unaccompanied .ts is present', async () => {
    const dir = await mkTmpDir('jorvel-config-jsonts-');
    await write(path.join(dir, 'jorvel.config.ts'), '// typed reference only\n');
    await write(
      path.join(dir, 'jorvel.config.json'),
      JSON.stringify({ name: 'from-json', appsDir: 'apps' }),
    );
    const { cfg } = await loadWorkspaceConfig(dir);
    expect(cfg.name).toBe('from-json');
    expect(cfg.appsDir).toBe('apps');
  });

  it('loads a compiled jorvel.config.js sibling', async () => {
    const dir = await mkTmpDir('jorvel-config-jsts-');
    await write(path.join(dir, 'jorvel.config.ts'), '// source\n');
    await write(
      path.join(dir, 'jorvel.config.js'),
      "export default { name: 'from-js' };\n",
    );
    const { cfg } = await loadWorkspaceConfig(dir);
    expect(cfg.name).toBe('from-js');
  });
});
