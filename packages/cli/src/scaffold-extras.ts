/**
 * Workspace "niceties" scaffolded at `jorvel init`: editor config, GitHub
 * community health files, issue/PR templates, a CodeQL workflow, Changesets
 * config, and a LICENSE. Split out of init.ts so it stays testable in isolation.
 */

import path from 'node:path';
import fs from 'fs-extra';

export interface ScaffoldExtrasOptions {
  workspaceDir: string;
  name: string;
  /** Package manager — drives recommended VS Code tasks / catalog hints. */
  pm: 'pnpm' | 'npm' | 'yarn' | 'bun';
  /** Author/owner for LICENSE + CODEOWNERS. Defaults derived from `name`. */
  author?: string;
  /** Current year for the LICENSE (injectable for deterministic tests). */
  year?: number;
  /** License to emit. Default `MIT`. `none` skips the LICENSE file. */
  license?: 'MIT' | 'Apache-2.0' | 'none';
}

async function write(file: string, content: string) {
  await fs.outputFile(file, content, 'utf8');
}

async function writeJson(file: string, obj: unknown) {
  await fs.outputFile(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

/** Write all editor + GitHub + tooling extras. Returns written relative paths. */
export async function writeWorkspaceExtras(opts: ScaffoldExtrasOptions): Promise<string[]> {
  const { workspaceDir, name } = opts;
  const author = opts.author ?? name;
  const year = opts.year ?? new Date().getFullYear();
  const written: string[] = [];
  const rel = (p: string) => path.relative(workspaceDir, p);
  const add = async (p: string, fn: () => Promise<void>) => {
    await fn();
    written.push(rel(p));
  };

  // ── .vscode ──────────────────────────────────────────────────────────────
  const vscodeSettings = path.join(workspaceDir, '.vscode', 'settings.json');
  await add(vscodeSettings, () =>
    writeJson(vscodeSettings, {
      'editor.formatOnSave': true,
      'editor.defaultFormatter': 'esbenp.prettier-vscode',
      'editor.codeActionsOnSave': { 'source.fixAll.eslint': 'explicit' },
      'eslint.useFlatConfig': true,
      'typescript.tsdk': 'node_modules/typescript/lib',
      'typescript.enablePromptUseWorkspaceTsdk': true,
      'tailwindCSS.experimental.classRegex': [['clsx\\(([^)]*)\\)', "'([^']*)'"]],
      'files.exclude': { '**/dist': true, '**/.turbo': true },
      'vitest.enable': true,
    }),
  );

  const vscodeExt = path.join(workspaceDir, '.vscode', 'extensions.json');
  await add(vscodeExt, () =>
    writeJson(vscodeExt, {
      recommendations: [
        'dbaeumer.vscode-eslint',
        'esbenp.prettier-vscode',
        'bradlc.vscode-tailwindcss',
        'vitest.explorer',
        'ms-playwright.playwright',
      ],
    }),
  );

  // ── Node version pin ──────────────────────────────────────────────────────
  const nvmrc = path.join(workspaceDir, '.nvmrc');
  await add(nvmrc, () => write(nvmrc, '22\n'));
  const nodeVersion = path.join(workspaceDir, '.node-version');
  await add(nodeVersion, () => write(nodeVersion, '22\n'));

  // ── .editorconfig ──────────────────────────────────────────────────────────
  const editorconfig = path.join(workspaceDir, '.editorconfig');
  await add(editorconfig, () =>
    write(
      editorconfig,
      [
        'root = true',
        '',
        '[*]',
        'charset = utf-8',
        'end_of_line = lf',
        'insert_final_newline = true',
        'trim_trailing_whitespace = true',
        'indent_style = space',
        'indent_size = 2',
        '',
        '[*.md]',
        'trim_trailing_whitespace = false',
        '',
        '[*.{yml,yaml}]',
        'indent_size = 2',
        '',
      ].join('\n'),
    ),
  );

  // ── LICENSE (chooser: MIT default · Apache-2.0 · none) ────────────────────────
  const licenseChoice = opts.license ?? 'MIT';
  if (licenseChoice !== 'none') {
    const license = path.join(workspaceDir, 'LICENSE');
    const MIT = [
      'MIT License',
      '',
      `Copyright (c) ${year} ${author}`,
      '',
      'Permission is hereby granted, free of charge, to any person obtaining a copy',
      'of this software and associated documentation files (the "Software"), to deal',
      'in the Software without restriction, including without limitation the rights',
      'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
      'copies of the Software, and to permit persons to whom the Software is',
      'furnished to do so, subject to the following conditions:',
      '',
      'The above copyright notice and this permission notice shall be included in all',
      'copies or substantial portions of the Software.',
      '',
      'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
      'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
      'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
      'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
      'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
      'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
      'SOFTWARE.',
      '',
    ].join('\n');
    const APACHE = [
      '                                 Apache License',
      '                           Version 2.0, January 2004',
      '                        http://www.apache.org/licenses/',
      '',
      `Copyright ${year} ${author}`,
      '',
      'Licensed under the Apache License, Version 2.0 (the "License"); you may not',
      'use this file except in compliance with the License. You may obtain a copy of',
      'the License at http://www.apache.org/licenses/LICENSE-2.0',
      '',
      'Unless required by applicable law or agreed to in writing, software',
      'distributed under the License is distributed on an "AS IS" BASIS, WITHOUT',
      'WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the',
      'License for the specific language governing permissions and limitations under',
      'the License.',
      '',
    ].join('\n');
    await add(license, () => write(license, licenseChoice === 'Apache-2.0' ? APACHE : MIT));
  }

  // ── Toolchain pins: Brewfile + mise.toml ─────────────────────────────────────
  const brewfile = path.join(workspaceDir, 'Brewfile');
  await add(brewfile, () =>
    write(brewfile, ['brew "node@22"', 'brew "pnpm"', 'brew "git"', ''].join('\n')),
  );
  const mise = path.join(workspaceDir, 'mise.toml');
  await add(mise, () => write(mise, ['[tools]', 'node = "22"', 'pnpm = "latest"', ''].join('\n')));

  // ── Community health files ──────────────────────────────────────────────────
  const contributing = path.join(workspaceDir, 'CONTRIBUTING.md');
  await add(contributing, () =>
    write(
      contributing,
      [
        `# Contributing to ${name}`,
        '',
        'Thanks for helping out! This is a JORVEL micro-frontend workspace.',
        '',
        '## Setup',
        '',
        '```sh',
        `${opts.pm} install`,
        'jorvel dev',
        '```',
        '',
        '## Before opening a PR',
        '',
        '- `jorvel typecheck` and `jorvel lint` pass',
        '- Tests pass (`jorvel test` / `pnpm -r test`)',
        '- `jorvel federation diff --base main` reports no unexpected breaking changes',
        '- Add a changeset: `pnpm changeset`',
        '',
        '## Commit style',
        '',
        'Conventional Commits (`feat:`, `fix:`, `docs:`…). Keep PRs focused.',
        '',
      ].join('\n'),
    ),
  );

  const coc = path.join(workspaceDir, 'CODE_OF_CONDUCT.md');
  await add(coc, () =>
    write(
      coc,
      [
        '# Code of Conduct',
        '',
        'This project adopts the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) v2.1.',
        '',
        'Be respectful. Harassment is not tolerated. Report incidents to the maintainers',
        'listed in `CODEOWNERS`. Maintainers may remove, edit, or reject contributions',
        'that violate this Code of Conduct.',
        '',
      ].join('\n'),
    ),
  );

  const security = path.join(workspaceDir, 'SECURITY.md');
  await add(security, () =>
    write(
      security,
      [
        '# Security Policy',
        '',
        '## Reporting a vulnerability',
        '',
        'Please do **not** open a public issue for security problems. Email the',
        'maintainers (see `CODEOWNERS`) or use GitHub private vulnerability reporting.',
        'We aim to acknowledge within 48 hours.',
        '',
        '## Supported versions',
        '',
        'The latest released version receives security fixes.',
        '',
      ].join('\n'),
    ),
  );

  // ── .github ──────────────────────────────────────────────────────────────
  const codeowners = path.join(workspaceDir, '.github', 'CODEOWNERS');
  await add(codeowners, () =>
    write(codeowners, [`# Default owners for everything in the repo`, `* @${author}`, ''].join('\n')),
  );

  const prTemplate = path.join(workspaceDir, '.github', 'PULL_REQUEST_TEMPLATE.md');
  await add(prTemplate, () =>
    write(
      prTemplate,
      [
        '## What',
        '',
        '<!-- What does this change? -->',
        '',
        '## Why',
        '',
        '<!-- Motivation / linked issue -->',
        '',
        '## Checklist',
        '',
        '- [ ] Typecheck + lint pass',
        '- [ ] Tests added/updated',
        '- [ ] `jorvel federation diff --base main` reviewed (no unexpected breaking changes)',
        '- [ ] Changeset added (`pnpm changeset`)',
        '',
      ].join('\n'),
    ),
  );

  const bug = path.join(workspaceDir, '.github', 'ISSUE_TEMPLATE', 'bug_report.md');
  await add(bug, () =>
    write(
      bug,
      [
        '---',
        'name: Bug report',
        'about: Something is broken',
        'labels: bug',
        '---',
        '',
        '**Describe the bug**',
        '',
        '**Reproduction** (steps, or a minimal repo)',
        '',
        '**Expected vs actual**',
        '',
        '**Environment** (`jorvel info` output)',
        '',
      ].join('\n'),
    ),
  );

  const feature = path.join(workspaceDir, '.github', 'ISSUE_TEMPLATE', 'feature_request.md');
  await add(feature, () =>
    write(
      feature,
      [
        '---',
        'name: Feature request',
        'about: Suggest an idea',
        'labels: enhancement',
        '---',
        '',
        '**Problem**',
        '',
        '**Proposed solution**',
        '',
        '**Alternatives considered**',
        '',
      ].join('\n'),
    ),
  );

  const issueConfig = path.join(workspaceDir, '.github', 'ISSUE_TEMPLATE', 'config.yml');
  await add(issueConfig, () =>
    write(
      issueConfig,
      [
        'blank_issues_enabled: false',
        'contact_links:',
        '  - name: Questions & Discussions',
        '    url: https://github.com/Ravikisha/JorvelJS/discussions',
        '    about: Ask questions and share ideas with the community',
        '',
      ].join('\n'),
    ),
  );

  // ── CodeQL workflow ──────────────────────────────────────────────────────────
  const codeql = path.join(workspaceDir, '.github', 'workflows', 'codeql.yml');
  await add(codeql, () =>
    write(
      codeql,
      [
        'name: CodeQL',
        'on:',
        '  push:',
        '    branches: [main]',
        '  pull_request:',
        '    branches: [main]',
        '  schedule:',
        "    - cron: '30 2 * * 1'",
        'jobs:',
        '  analyze:',
        '    name: Analyze',
        '    runs-on: ubuntu-latest',
        '    permissions:',
        '      actions: read',
        '      contents: read',
        '      security-events: write',
        '    strategy:',
        '      matrix:',
        "        language: ['javascript-typescript']",
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - name: Initialize CodeQL',
        '        uses: github/codeql-action/init@v3',
        '        with:',
        '          languages: ${{ matrix.language }}',
        '      - name: Autobuild',
        '        uses: github/codeql-action/autobuild@v3',
        '      - name: Perform CodeQL Analysis',
        '        uses: github/codeql-action/analyze@v3',
        '',
      ].join('\n'),
    ),
  );

  const release = path.join(workspaceDir, '.github', 'workflows', 'release.yml');
  await add(release, () =>
    write(
      release,
      [
        'name: Release',
        'on:',
        '  push:',
        '    branches: [main]',
        'concurrency: ${{ github.workflow }}-${{ github.ref }}',
        'jobs:',
        '  release:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - uses: pnpm/action-setup@v4',
        '      - uses: actions/setup-node@v4',
        '        with:',
        "          node-version: '22'",
        "          cache: 'pnpm'",
        '      - run: pnpm install --frozen-lockfile',
        '      - name: Create Release PR or publish',
        '        uses: changesets/action@v1',
        '        with:',
        '          publish: pnpm release',
        '        env:',
        '          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
        '          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}',
        '',
      ].join('\n'),
    ),
  );

  // ── Rate-limited API route example (wired with @jorvel/security) ──────────────
  const rlRoute = path.join(workspaceDir, 'examples', 'rate-limited-route.ts');
  await add(rlRoute, () =>
    write(
      rlRoute,
      [
        '// Example server route with a token-bucket rate limit. Wire it into your',
        '// SSR adapter / server handler. Uses @jorvel/security (edge-safe).',
        "import { RateLimiter } from '@jorvel/security';",
        '',
        '// ~60 req/min per client: 60 capacity, refilling 1/sec.',
        'const limiter = new RateLimiter({ capacity: 60, refillPerSec: 1 });',
        '',
        'export async function handle(request: Request): Promise<Response> {',
        "  const ip = request.headers.get('x-forwarded-for') ?? 'anon';",
        '  const r = limiter.consume(ip);',
        '  if (!r.ok) {',
        "    return new Response('Too Many Requests', {",
        '      status: 429,',
        "      headers: { 'retry-after': String(Math.ceil(r.retryAfterMs / 1000)) },",
        '    });',
        '  }',
        "  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });",
        '}',
        '',
      ].join('\n'),
    ),
  );

  // ── Contract-test + bundle-size PR workflows ──────────────────────────────────
  const contractWf = path.join(workspaceDir, '.github', 'workflows', 'contract-tests.yml');
  await add(contractWf, () =>
    write(
      contractWf,
      [
        'name: Federation contracts',
        'on:',
        '  pull_request:',
        '    branches: [main]',
        'jobs:',
        '  contracts:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '        with: { fetch-depth: 0 }        # need base ref for the diff',
        '      - uses: pnpm/action-setup@v4',
        '      - uses: actions/setup-node@v4',
        "        with: { node-version: '22', cache: 'pnpm' }",
        '      - run: pnpm install --frozen-lockfile',
        '      - name: Contract diff (fail on breaking)',
        '        run: pnpm jorvel federation diff --base origin/${{ github.base_ref }}',
        '      - name: Contract tests',
        '        run: pnpm -r --if-present test',
        '',
      ].join('\n'),
    ),
  );

  const sizeWf = path.join(workspaceDir, '.github', 'workflows', 'bundle-size.yml');
  await add(sizeWf, () =>
    write(
      sizeWf,
      [
        'name: Bundle size',
        'on:',
        '  pull_request:',
        '    branches: [main]',
        'jobs:',
        '  size:',
        '    runs-on: ubuntu-latest',
        '    permissions: { contents: read, pull-requests: write }',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - uses: pnpm/action-setup@v4',
        '      - uses: actions/setup-node@v4',
        "        with: { node-version: '22', cache: 'pnpm' }",
        '      - run: pnpm install --frozen-lockfile',
        '      - run: pnpm build',
        '      # Diff remoteEntry + chunk sizes vs base and comment on the PR.',
        '      - uses: preactjs/compressed-size-action@v2',
        '        with:',
        '          repo-token: ${{ secrets.GITHUB_TOKEN }}',
        "          pattern: 'apps/*/dist/**/*.{js,css}'",
        '',
      ].join('\n'),
    ),
  );

  // ── Sponsors (GitHub Sponsors / funding links) ───────────────────────────────
  const funding = path.join(workspaceDir, '.github', 'FUNDING.yml');
  await add(funding, () =>
    write(
      funding,
      [
        '# Uncomment + fill the platforms you use. https://docs.github.com/sponsors',
        `# github: [${author}]`,
        '# open_collective: your-collective',
        '# ko_fi: your-handle',
        '# custom: ["https://your-site.com/sponsor"]',
        '',
      ].join('\n'),
    ),
  );

  // ── Dependabot ──────────────────────────────────────────────────────────────
  const dependabot = path.join(workspaceDir, '.github', 'dependabot.yml');
  await add(dependabot, () =>
    write(
      dependabot,
      [
        'version: 2',
        'updates:',
        '  - package-ecosystem: npm',
        '    directory: "/"',
        '    schedule: { interval: weekly }',
        '    groups:',
        '      dev-dependencies: { dependency-type: development }',
        '  - package-ecosystem: github-actions',
        '    directory: "/"',
        '    schedule: { interval: weekly }',
        '',
      ].join('\n'),
    ),
  );

  // ── Secret scanning (gitleaks) ────────────────────────────────────────────────
  const gitleaksCfg = path.join(workspaceDir, '.gitleaks.toml');
  await add(gitleaksCfg, () =>
    write(
      gitleaksCfg,
      [
        'title = "gitleaks config"',
        '[extend]',
        'useDefault = true',
        '',
        '[allowlist]',
        'description = "Ignore example env + lockfiles"',
        'paths = [\'\'\'\\.env\\.example$\'\'\', \'\'\'pnpm-lock\\.yaml$\'\'\']',
        '',
      ].join('\n'),
    ),
  );
  const gitleaksWf = path.join(workspaceDir, '.github', 'workflows', 'gitleaks.yml');
  await add(gitleaksWf, () =>
    write(
      gitleaksWf,
      [
        'name: Secret scan',
        'on:',
        '  pull_request:',
        '  push:',
        '    branches: [main]',
        'jobs:',
        '  gitleaks:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '        with: { fetch-depth: 0 }',
        '      - uses: gitleaks/gitleaks-action@v2',
        '        env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }',
        '',
      ].join('\n'),
    ),
  );

  // ── Lighthouse CI ──────────────────────────────────────────────────────────────
  const lhrc = path.join(workspaceDir, 'lighthouserc.json');
  await add(lhrc, () =>
    writeJson(lhrc, {
      ci: {
        collect: { startServerCommand: 'jorvel ssr serve', url: ['http://localhost:3000/'], numberOfRuns: 3 },
        assert: {
          preset: 'lighthouse:recommended',
          assertions: {
            'categories:performance': ['warn', { minScore: 0.9 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
          },
        },
        upload: { target: 'temporary-public-storage' },
      },
    }),
  );
  const lhWf = path.join(workspaceDir, '.github', 'workflows', 'lighthouse.yml');
  await add(lhWf, () =>
    write(
      lhWf,
      [
        'name: Lighthouse CI',
        'on:',
        '  pull_request:',
        '    branches: [main]',
        'jobs:',
        '  lighthouse:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - uses: pnpm/action-setup@v4',
        '      - uses: actions/setup-node@v4',
        "        with: { node-version: '22', cache: 'pnpm' }",
        '      - run: pnpm install --frozen-lockfile',
        '      - run: pnpm build',
        '      - run: pnpm dlx @lhci/cli@0.14.x autorun',
        '',
      ].join('\n'),
    ),
  );

  // ── Husky + lint-staged + commitlint ─────────────────────────────────────────
  const preCommit = path.join(workspaceDir, '.husky', 'pre-commit');
  await add(preCommit, () => write(preCommit, 'pnpm lint-staged\n'));
  const commitMsg = path.join(workspaceDir, '.husky', 'commit-msg');
  await add(commitMsg, () => write(commitMsg, 'pnpm commitlint --edit "$1"\n'));
  const lintstaged = path.join(workspaceDir, '.lintstagedrc.json');
  await add(lintstaged, () =>
    writeJson(lintstaged, {
      '*.{ts,tsx,js,jsx}': ['eslint --fix', 'prettier --write'],
      '*.{json,md,yml,yaml,css}': ['prettier --write'],
    }),
  );
  const commitlint = path.join(workspaceDir, 'commitlint.config.mjs');
  await add(commitlint, () =>
    write(commitlint, "export default { extends: ['@commitlint/config-conventional'] };\n"),
  );

  // ── Visual-regression (Playwright snapshots) ─────────────────────────────────
  const visualSpec = path.join(workspaceDir, 'tests', 'visual', 'home.spec.ts');
  await add(visualSpec, () =>
    write(
      visualSpec,
      [
        "import { test, expect } from '@playwright/test';",
        '',
        '// Visual-regression baseline. First run records snapshots; CI compares.',
        "// Update intentionally with: pnpm playwright test --update-snapshots",
        "test('home page looks right', async ({ page }) => {",
        "  await page.goto('/');",
        "  await expect(page).toHaveScreenshot('home.png', { fullPage: true, maxDiffPixelRatio: 0.01 });",
        '});',
        '',
      ].join('\n'),
    ),
  );

  const visualWf = path.join(workspaceDir, '.github', 'workflows', 'visual.yml');
  await add(visualWf, () =>
    write(
      visualWf,
      [
        'name: Visual regression',
        'on:',
        '  pull_request:',
        '    branches: [main]',
        'jobs:',
        '  visual:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - uses: pnpm/action-setup@v4',
        '      - uses: actions/setup-node@v4',
        "        with: { node-version: '22', cache: 'pnpm' }",
        '      - run: pnpm install --frozen-lockfile',
        '      - run: pnpm exec playwright install --with-deps chromium',
        '      - run: pnpm build',
        '      - name: Visual snapshots',
        '        run: pnpm exec playwright test tests/visual',
        '      - uses: actions/upload-artifact@v4',
        '        if: failure()',
        '        with: { name: playwright-report, path: playwright-report/ }',
        '',
      ].join('\n'),
    ),
  );

  // ── Changesets ──────────────────────────────────────────────────────────────
  const changesetConfig = path.join(workspaceDir, '.changeset', 'config.json');
  await add(changesetConfig, () =>
    writeJson(changesetConfig, {
      $schema: 'https://unpkg.com/@changesets/config@3.0.0/schema.json',
      changelog: '@changesets/cli/changelog',
      commit: false,
      fixed: [],
      linked: [],
      access: 'restricted',
      baseBranch: 'main',
      updateInternalDependencies: 'patch',
      ignore: [],
    }),
  );

  const changesetReadme = path.join(workspaceDir, '.changeset', 'README.md');
  await add(changesetReadme, () =>
    write(
      changesetReadme,
      [
        '# Changesets',
        '',
        'Run `pnpm changeset` to record a version bump + changelog entry for your change.',
        'See https://github.com/changesets/changesets for details.',
        '',
      ].join('\n'),
    ),
  );

  return written;
}
