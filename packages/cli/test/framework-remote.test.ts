import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { scaffoldFrameworkRemote } from '../src/frameworks/scaffold.js';
import {
  FRAMEWORKS,
  FRAMEWORK_IDS,
  getFrameworkSpec,
  isFrameworkId,
} from '../src/frameworks/registry.js';

const NON_REACT = ['vue', 'solid', 'svelte', 'angular'] as const;

async function tmp() {
  return (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fw-'))) as string;
}

describe('framework registry', () => {
  it('lists react + the four non-react frameworks', () => {
    expect(FRAMEWORK_IDS).toEqual(['react', 'vue', 'solid', 'svelte', 'angular']);
  });
  it('isFrameworkId guards correctly', () => {
    expect(isFrameworkId('vue')).toBe(true);
    expect(isFrameworkId('ember')).toBe(false);
  });
  it('getFrameworkSpec returns null for react, a spec for others', () => {
    expect(getFrameworkSpec('react')).toBeNull();
    expect(getFrameworkSpec('vue')?.adapter).toBe('@jorvel/adapter-vue');
  });
  it('every non-react spec references its adapter + define fn in the remote entry', () => {
    for (const id of NON_REACT) {
      const spec = FRAMEWORKS[id];
      const entry = spec.remoteEntry('demo');
      expect(entry).toContain(spec.adapter);
      expect(entry).toContain(spec.defineFn);
    }
  });
});

describe.each(NON_REACT)('scaffoldFrameworkRemote — %s', (id) => {
  it('writes a coherent remote (entry, root, config, skill)', async () => {
    const dir = await tmp();
    const appDir = path.join(dir, 'apps', `${id}-app`);
    const spec = FRAMEWORKS[id];
    await scaffoldFrameworkRemote(appDir, `${id}-app`, 3100, spec);

    // package.json — adapter + framework deps, no React runtime
    const pkg = await fs.readJson(path.join(appDir, 'package.json'));
    expect(pkg.dependencies[spec.adapter]).toBe('^0.3.0');
    expect(pkg.dependencies['@jorvel/runtime']).toBeUndefined();
    expect(pkg.dependencies['react']).toBeUndefined();
    expect(pkg.scripts.dev).toBe('rspack serve');

    // exposed entry uses the adapter
    const entry = await fs.readFile(path.join(appDir, 'src/remote.ts'), 'utf8');
    expect(entry).toContain(`${spec.defineFn}`);

    // sample root component present (TS is the default)
    expect(await fs.pathExists(path.join(appDir, spec.rootComponent(`${id}-app`, 'ts').file))).toBe(true);

    // rspack config has the framework loader rule + MF plugin
    const cfg = await fs.readFile(path.join(appDir, 'rspack.config.mjs'), 'utf8');
    expect(cfg).toContain('ModuleFederationPlugin');
    expect(cfg).toContain("entry: { main: ['./src/mf-shim.js', './src/main.ts'] }");

    // standalone dev bootstrap mounts via the neutral contract
    const boot = await fs.readFile(path.join(appDir, 'src/bootstrap.ts'), 'utf8');
    expect(boot).toContain('remote.mount(');

    // per-app AI skill
    const skill = await fs.readFile(path.join(appDir, '.claude', 'skills', `${id}-remote.md`), 'utf8');
    expect(skill).toMatch(/^---\s*\nname:/);
    expect(skill).toContain(`${id}-remote`);
  });

  it('omits Tailwind by default', async () => {
    const dir = await tmp();
    const appDir = path.join(dir, 'apps', `${id}-plain`);
    await scaffoldFrameworkRemote(appDir, `${id}-plain`, 3100, FRAMEWORKS[id]);
    expect(await fs.pathExists(path.join(appDir, 'tailwind.config.cjs'))).toBe(false);
    expect(await fs.pathExists(path.join(appDir, 'postcss.config.cjs'))).toBe(false);
    const styles = await fs.readFile(path.join(appDir, 'src/styles.css'), 'utf8');
    expect(styles).not.toContain('@tailwind');
  });

  it("wires Tailwind when tailwind='on'", async () => {
    const dir = await tmp();
    const appDir = path.join(dir, 'apps', `${id}-tw`);
    const spec = FRAMEWORKS[id];
    await scaffoldFrameworkRemote(appDir, `${id}-tw`, 3100, spec, 'on');

    const pkg = await fs.readJson(path.join(appDir, 'package.json'));
    expect(pkg.devDependencies.tailwindcss).toBeDefined();
    expect(pkg.devDependencies['@tailwindcss/postcss']).toBeDefined();
    expect(pkg.devDependencies['postcss-loader']).toBeDefined();

    // Tailwind v4: PostCSS plugin config, CSS-first (no tailwind.config).
    const postcss = await fs.readFile(path.join(appDir, 'postcss.config.cjs'), 'utf8');
    expect(postcss).toContain('@tailwindcss/postcss');

    const styles = await fs.readFile(path.join(appDir, 'src/styles.css'), 'utf8');
    expect(styles).toContain('@import "tailwindcss"');
    // keeps the base helper CSS too
    expect(styles).toContain('.jorvel-remote');

    const cfg = await fs.readFile(path.join(appDir, 'rspack.config.mjs'), 'utf8');
    expect(cfg).toContain("use: ['postcss-loader']");
  });

  it('scaffolds JavaScript when lang=js (Angular stays TS)', async () => {
    const dir = await tmp();
    const appDir = path.join(dir, 'apps', `${id}-js`);
    const spec = FRAMEWORKS[id];
    await scaffoldFrameworkRemote(appDir, `${id}-js`, 3100, spec, 'off', 'js');

    if (spec.tsOnly) {
      // Angular is TS-only regardless of the requested language.
      expect(await fs.pathExists(path.join(appDir, 'src/remote.ts'))).toBe(true);
      expect(await fs.pathExists(path.join(appDir, 'tsconfig.json'))).toBe(true);
      return;
    }

    // JS entry files + jsconfig, no tsconfig.
    expect(await fs.pathExists(path.join(appDir, 'src/remote.js'))).toBe(true);
    expect(await fs.pathExists(path.join(appDir, 'src/remote.ts'))).toBe(false);
    expect(await fs.pathExists(path.join(appDir, 'jsconfig.json'))).toBe(true);
    expect(await fs.pathExists(path.join(appDir, 'tsconfig.json'))).toBe(false);
    // rspack entry points at the JS main.
    const cfg = await fs.readFile(path.join(appDir, 'rspack.config.mjs'), 'utf8');
    expect(cfg).toContain("'./src/main.js'");
    // Root component is the JS-flavored file (no TS types).
    const root = spec.rootComponent(`${id}-js`, 'js');
    const content = await fs.readFile(path.join(appDir, root.file), 'utf8');
    expect(content).not.toContain('lang="ts"');
    expect(content).not.toContain(': Record<string');
  });
});
