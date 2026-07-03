import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { writeWorkspaceExtras } from '../src/scaffold-extras.js';

async function run(): Promise<string> {
  const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-extras-'))) as string;
  await writeWorkspaceExtras({ workspaceDir: tmp, name: 'demo', pm: 'pnpm', author: 'acme', year: 2026 });
  return tmp;
}

describe('writeWorkspaceExtras', () => {
  it('writes editor + community + tooling files', async () => {
    const tmp = await run();
    for (const rel of [
      '.vscode/settings.json', '.vscode/extensions.json', '.editorconfig', 'LICENSE',
      'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md',
      '.github/CODEOWNERS', '.github/PULL_REQUEST_TEMPLATE.md',
      '.github/ISSUE_TEMPLATE/bug_report.md', '.github/workflows/codeql.yml',
      '.github/workflows/release.yml', '.changeset/config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmp, rel))).toBe(true);
    }
  });

  it('LICENSE is MIT with the given author + year', async () => {
    const tmp = await run();
    const license = await fs.readFile(path.join(tmp, 'LICENSE'), 'utf8');
    expect(license).toContain('MIT License');
    expect(license).toContain('Copyright (c) 2026 acme');
  });

  it('scaffolds contract-test + bundle-size PR workflows', async () => {
    const tmp = await run();
    const contract = await fs.readFile(path.join(tmp, '.github/workflows/contract-tests.yml'), 'utf8');
    expect(contract).toContain('federation diff --base origin/');
    const size = await fs.readFile(path.join(tmp, '.github/workflows/bundle-size.yml'), 'utf8');
    expect(size).toContain('compressed-size-action');
  });

  it('scaffolds a Playwright visual-regression preset', async () => {
    const tmp = await run();
    const spec = await fs.readFile(path.join(tmp, 'tests/visual/home.spec.ts'), 'utf8');
    expect(spec).toContain('toHaveScreenshot');
    const wf = await fs.readFile(path.join(tmp, '.github/workflows/visual.yml'), 'utf8');
    expect(wf).toContain('playwright test tests/visual');
  });

  it('scaffolds .nvmrc, .node-version, Brewfile, mise.toml', async () => {
    const tmp = await run();
    for (const f of ['.nvmrc', '.node-version', 'Brewfile', 'mise.toml']) {
      expect(await fs.pathExists(path.join(tmp, f))).toBe(true);
    }
    expect((await fs.readFile(path.join(tmp, '.nvmrc'), 'utf8')).trim()).toBe('22');
  });

  it('LICENSE chooser: Apache-2.0 and none', async () => {
    const apache = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-lic-'))) as string;
    await writeWorkspaceExtras({ workspaceDir: apache, name: 'a', pm: 'pnpm', license: 'Apache-2.0', year: 2026 });
    expect(await fs.readFile(path.join(apache, 'LICENSE'), 'utf8')).toContain('Apache License');

    const none = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-lic-'))) as string;
    await writeWorkspaceExtras({ workspaceDir: none, name: 'a', pm: 'pnpm', license: 'none' });
    expect(await fs.pathExists(path.join(none, 'LICENSE'))).toBe(false);
  });

  it('emits a rate-limited route example using RateLimiter', async () => {
    const tmp = await run();
    const route = await fs.readFile(path.join(tmp, 'examples/rate-limited-route.ts'), 'utf8');
    expect(route).toContain("import { RateLimiter } from '@jorvel/security'");
    expect(route).toContain('limiter.consume(ip)');
    expect(route).toContain('429');
  });
});
