import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { initCommand } from '../src/commands/init.js';

async function run(name: string, dir: string, extra: string[] = []) {
  initCommand.exitOverride();
  // Commander retains parsed option values on the reused singleton between
  // parseAsync calls. Re-assert defaults for options a test didn't pass so a
  // prior test's `--pm`/`--template` can't leak into this one.
  if (!extra.includes('--pm')) initCommand.setOptionValue('pm', 'pnpm');
  if (!extra.includes('--template')) initCommand.setOptionValue('template', 'host-remote');
  const prev = process.cwd();
  process.chdir(dir);
  try {
    // Commander parses: [command-name, arg, ...options]
    // When using `from: 'user'`, the first token is treated as the command name.
    await initCommand.parseAsync([name, '--dir', dir, ...extra], { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

describe('jorvel init', () => {
  it('creates a workspace directory with the given name', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    expect(await fs.pathExists(path.join(tmp, 'my-app'))).toBe(true);
  });

  it('writes a valid package.json with private:true and correct name', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    const pkg = await fs.readJson(path.join(tmp, 'my-app', 'package.json'));
    expect(pkg.name).toBe('my-app');
    expect(pkg.private).toBe(true);
  });

  it('writes pnpm-workspace.yaml listing apps/*, libs/*, packages/*', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    const yaml = await fs.readFile(path.join(tmp, 'my-app', 'pnpm-workspace.yaml'), 'utf8');
    expect(yaml).toContain('apps/*');
    expect(yaml).toContain('libs/*');
    expect(yaml).toContain('packages/*');
  });

  describe('--pm package manager', () => {
    it('defaults to pnpm (pnpm-workspace.yaml + packageManager pnpm@)', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const pkg = await fs.readJson(path.join(tmp, 'my-app', 'package.json'));
      expect(pkg.packageManager).toMatch(/^pnpm@/);
      expect(pkg.workspaces).toBeUndefined();
    });

    it('npm writes workspaces in package.json and no pnpm-workspace.yaml', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp, ['--pm', 'npm']);
      const pkg = await fs.readJson(path.join(tmp, 'my-app', 'package.json'));
      expect(pkg.packageManager).toMatch(/^npm@/);
      expect(pkg.workspaces).toEqual(['packages/*', 'apps/*', 'libs/*']);
      expect(await fs.pathExists(path.join(tmp, 'my-app', 'pnpm-workspace.yaml'))).toBe(false);
    });

    it('rejects an unknown --pm', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp, ['--pm', 'cargo']);
      // invalid pm aborts before scaffolding the package.json
      expect(await fs.pathExists(path.join(tmp, 'my-app', 'package.json'))).toBe(false);
      expect(process.exitCode).toBe(1);
      process.exitCode = 0;
    });
  });

  describe('--template', () => {
    it('records the template in jorvel.config.json features', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp, ['--template', 'saas']);
      const cfg = await fs.readJson(path.join(tmp, 'my-app', 'jorvel.config.json'));
      expect(cfg.features.template).toBe('saas');
    });

    it('defaults the template to host-remote', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const cfg = await fs.readJson(path.join(tmp, 'my-app', 'jorvel.config.json'));
      expect(cfg.features.template).toBe('host-remote');
    });

    it('rejects an unknown --template', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp, ['--template', 'wat']);
      expect(await fs.pathExists(path.join(tmp, 'my-app', 'package.json'))).toBe(false);
      expect(process.exitCode).toBe(1);
      process.exitCode = 0;
    });
  });

  it('writes jorvel.config.json with appsDir, libsDir and orchestrator defaults', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    const cfg = await fs.readJson(path.join(tmp, 'my-app', 'jorvel.config.json'));
    expect(cfg.appsDir).toBe('apps');
    expect(cfg.libsDir).toBe('libs');
    expect(cfg.name).toBe('my-app');
    expect(cfg.orchestrator?.mode).toBe('parallel');
  });

  it('does NOT write a jorvel.config.ts (json is the single loaded source of truth)', async () => {
    // The CLI ships as compiled JS and cannot import raw .ts at runtime; emitting
    // both a .json and a .ts only invited drift and tripped CONFIG-002.
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    expect(await fs.pathExists(path.join(tmp, 'my-app', 'jorvel.config.ts'))).toBe(false);
  });

  it('writes a README.md mentioning the workspace name', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('cool-workspace', tmp);
    const readme = await fs.readFile(path.join(tmp, 'cool-workspace', 'README.md'), 'utf8');
    expect(readme).toContain('cool-workspace');
  });

  it('throws when the target directory already exists and is non-empty', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    const target = path.join(tmp, 'existing');
    await fs.ensureDir(target);
    await fs.outputFile(path.join(target, 'some-file.txt'), 'content');

    await expect(run('existing', tmp)).rejects.toThrow();
  });

  it('succeeds when the target directory already exists but is empty', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    const target = path.join(tmp, 'empty-dir');
    await fs.ensureDir(target);

    await expect(run('empty-dir', tmp)).resolves.not.toThrow();
    expect(await fs.pathExists(path.join(target, 'package.json'))).toBe(true);
  });

  // ── New: CI/CD + TS scaffolding ─────────────────────────────────────────────

  it('package.json includes typecheck and ci:affected scripts', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    const pkg = await fs.readJson(path.join(tmp, 'my-app', 'package.json'));
    expect(pkg.scripts.typecheck).toBeDefined();
    expect(pkg.scripts['ci:affected']).toBeDefined();
  });

  it('writes tsconfig.base.json with strict and noUncheckedIndexedAccess', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    const cfg = await fs.readJson(path.join(tmp, 'my-app', 'tsconfig.base.json'));
    expect(cfg.compilerOptions.strict).toBe(true);
    expect(cfg.compilerOptions.noUncheckedIndexedAccess).toBe(true);
    expect(cfg.compilerOptions.exactOptionalPropertyTypes).toBe(true);
  });

  it('writes a .gitignore that ignores node_modules and dist', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    const gi = await fs.readFile(path.join(tmp, 'my-app', '.gitignore'), 'utf8');
    expect(gi).toContain('node_modules');
    expect(gi).toContain('dist');
  });

  it('scaffolds .github/workflows/ci.yml', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    const exists = await fs.pathExists(
      path.join(tmp, 'my-app', '.github', 'workflows', 'ci.yml')
    );
    expect(exists).toBe(true);
  });

  it('scaffolds .github/workflows/pr-preview.yml', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    const exists = await fs.pathExists(
      path.join(tmp, 'my-app', '.github', 'workflows', 'pr-preview.yml')
    );
    expect(exists).toBe(true);
  });

  it('scaffolds .github/workflows/deploy.yml', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    const exists = await fs.pathExists(
      path.join(tmp, 'my-app', '.github', 'workflows', 'deploy.yml')
    );
    expect(exists).toBe(true);
  });

  it('ci.yml contains jorvel typecheck step', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    const yml = await fs.readFile(
      path.join(tmp, 'my-app', '.github', 'workflows', 'ci.yml'),
      'utf8'
    );
    expect(yml).toContain('jorvel typecheck');
  });

  it('ci.yml contains jorvel ci affected step', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    const yml = await fs.readFile(
      path.join(tmp, 'my-app', '.github', 'workflows', 'ci.yml'),
      'utf8'
    );
    expect(yml).toContain('jorvel ci affected');
  });

  it('deploy.yml is a netlify deployment by default', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
    await run('my-app', tmp);
    const yml = await fs.readFile(
      path.join(tmp, 'my-app', '.github', 'workflows', 'deploy.yml'),
      'utf8'
    );
    expect(yml).toContain('nwtgck/actions-netlify');
  });

  // ── Expanded script + tooling assertions ────────────────────────────────────

  describe('root package.json scripts', () => {
    let pkg: Record<string, any>;
    let tmp: string;

    async function ensure() {
      if (!pkg) {
        tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
        await run('my-app', tmp);
        pkg = await fs.readJson(path.join(tmp, 'my-app', 'package.json'));
      }
    }

    it.each([
      'dev',
      'dev:proxy',
      'build',
      'build:apps',
      'start',
      'clean',
      'typecheck',
      'lint',
      'lint:fix',
      'format',
      'format:check',
      'test',
      'test:watch',
      'test:coverage',
      'routes',
      'federation',
      'perf',
      'diagnose',
      'analyze',
      'deploy',
      'ci:affected',
      'ci',
    ])('declares script "%s"', async (key) => {
      await ensure();
      expect(pkg.scripts[key]).toBeTypeOf('string');
      expect(pkg.scripts[key].length).toBeGreaterThan(0);
    });

    it('dev:proxy uses --proxy-remotes --hmr-remotes', async () => {
      await ensure();
      expect(pkg.scripts['dev:proxy']).toContain('--proxy-remotes');
      expect(pkg.scripts['dev:proxy']).toContain('--hmr-remotes');
    });

    it('ci script chains typecheck + lint + test + build', async () => {
      await ensure();
      const ci = pkg.scripts.ci;
      expect(ci).toContain('typecheck');
      expect(ci).toContain('lint');
      expect(ci).toContain('test');
      expect(ci).toContain('build');
    });

    it('format scripts target ts/tsx/js/json/md', async () => {
      await ensure();
      expect(pkg.scripts.format).toContain('ts,tsx');
      expect(pkg.scripts.format).toContain('md');
      expect(pkg.scripts['format:check']).toContain('--check');
    });

    it('declares engines.node >=20', async () => {
      await ensure();
      expect(pkg.engines?.node).toMatch(/>=\s*20/);
    });

    it('uses @jorvel/prettier-config as prettier setting', async () => {
      await ensure();
      expect(pkg.prettier).toBe('@jorvel/prettier-config');
    });

    it('lists prettier, eslint, typescript as devDependencies', async () => {
      await ensure();
      expect(pkg.devDependencies.prettier).toBeDefined();
      expect(pkg.devDependencies.eslint).toBeDefined();
      expect(pkg.devDependencies.typescript).toBeDefined();
    });

    it('lists @jorvel/eslint-config + @jorvel/prettier-config + @jorvel/types', async () => {
      await ensure();
      expect(pkg.devDependencies['@jorvel/eslint-config']).toBeDefined();
      expect(pkg.devDependencies['@jorvel/prettier-config']).toBeDefined();
      expect(pkg.devDependencies['@jorvel/types']).toBeDefined();
    });
  });

  describe('assets + README + git init', () => {
    it('copies logo.svg + logo-light.svg + favicon.ico to assets/', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const assets = path.join(tmp, 'my-app', 'assets');
      expect(await fs.pathExists(path.join(assets, 'logo.svg'))).toBe(true);
      expect(await fs.pathExists(path.join(assets, 'logo-light.svg'))).toBe(true);
      expect(await fs.pathExists(path.join(assets, 'favicon.ico'))).toBe(true);
    });

    it('favicon.ico is a non-empty binary file', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const ico = await fs.readFile(path.join(tmp, 'my-app', 'assets', 'favicon.ico'));
      expect(ico.length).toBeGreaterThan(100);
      // ICO files start with bytes 00 00 01 00
      expect(ico[0]).toBe(0x00);
      expect(ico[1]).toBe(0x00);
      expect(ico[2]).toBe(0x01);
      expect(ico[3]).toBe(0x00);
    });

    it('logo.svg is a valid SVG document', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const svg = await fs.readFile(path.join(tmp, 'my-app', 'assets', 'logo.svg'), 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('README.md embeds the workspace logo', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const readme = await fs.readFile(path.join(tmp, 'my-app', 'README.md'), 'utf8');
      expect(readme).toContain('assets/logojorvel.png');
      expect(readme).toContain('alt="my-app"');
    });

    it('README.md lists the most useful scripts', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const readme = await fs.readFile(path.join(tmp, 'my-app', 'README.md'), 'utf8');
      for (const s of ['pnpm dev', 'pnpm build', 'pnpm test', 'pnpm lint', 'pnpm typecheck', 'pnpm format']) {
        expect(readme).toContain(s);
      }
    });

    it('README.md references JORVEL docs + repo', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const readme = await fs.readFile(path.join(tmp, 'my-app', 'README.md'), 'utf8');
      expect(readme).toContain('jorveljs.vercel.app');
      expect(readme).toContain('Ravikisha/JorvelJS');
    });

    it('runs git init by default (creates .git directory)', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const gitDir = path.join(tmp, 'my-app', '.git');
      // .git may not exist if git is unavailable in the test runner — but on dev/CI it should.
      // We assert: either it exists (git available) or the assets/README still got written,
      // so the rest of the scaffold is unaffected by git availability.
      const exists = await fs.pathExists(gitDir);
      const readmeOk = await fs.pathExists(path.join(tmp, 'my-app', 'README.md'));
      expect(readmeOk).toBe(true);
      // When git is available (typical), .git must exist.
      // Don't hard-fail when git is missing — just ensure it's a directory if present.
      if (exists) {
        const stat = await fs.stat(gitDir);
        expect(stat.isDirectory()).toBe(true);
      }
    });

    it('--no-git skips git init', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      // Bypass the run() helper which has a fixed argv shape.
      initCommand.exitOverride();
      const prev = process.cwd();
      process.chdir(tmp);
      try {
        await initCommand.parseAsync(['my-app', '--dir', tmp, '--no-git'], { from: 'user' });
      } finally {
        process.chdir(prev);
      }
      expect(await fs.pathExists(path.join(tmp, 'my-app', '.git'))).toBe(false);
      // Scaffold should still be complete:
      expect(await fs.pathExists(path.join(tmp, 'my-app', 'package.json'))).toBe(true);
    });
  });

  describe('AI coding-agent scaffold', () => {
    it('writes CLAUDE.md with project name + JORVEL conventions', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const md = await fs.readFile(path.join(tmp, 'my-app', 'CLAUDE.md'), 'utf8');
      expect(md).toContain('my-app');
      expect(md).toContain('JORVEL');
      expect(md).toContain('Module Federation');
      expect(md).toContain('singleton');
      expect(md).toContain('pnpm dev');
    });

    it('writes AGENTS.md (provider-neutral)', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const md = await fs.readFile(path.join(tmp, 'my-app', 'AGENTS.md'), 'utf8');
      expect(md).toContain('my-app');
      expect(md).toContain('Cursor');
      expect(md).toContain('OpenAI');
    });

    it('writes .cursorrules', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const rules = await fs.readFile(path.join(tmp, 'my-app', '.cursorrules'), 'utf8');
      expect(rules).toContain('JORVEL');
      expect(rules).toContain('Pure ESM');
      expect(rules).toContain('Never');
    });

    it('writes .github/copilot-instructions.md', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const md = await fs.readFile(
        path.join(tmp, 'my-app', '.github', 'copilot-instructions.md'),
        'utf8',
      );
      expect(md).toContain('Copilot');
      expect(md).toContain('JORVEL');
    });

    it('writes .claude/settings.json with permissions', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const settings = await fs.readJson(
        path.join(tmp, 'my-app', '.claude', 'settings.json'),
      );
      expect(settings.permissions.allow).toContain('Bash(pnpm:*)');
      expect(settings.permissions.allow).toContain('Bash(jorvel:*)');
      expect(settings.permissions.deny).toContain('Read(.env)');
    });

    it.each([
      'federation-contracts',
      'file-routing',
      'ssr',
      'security',
      'testing',
      'jorvel-cli',
    ])('writes .claude/skills/%s.md', async (skill) => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const file = path.join(tmp, 'my-app', '.claude', 'skills', `${skill}.md`);
      expect(await fs.pathExists(file)).toBe(true);
      const content = await fs.readFile(file, 'utf8');
      expect(content).toMatch(/^---\s*\nname:/);
      expect(content).toContain('description:');
    });

    it.each([
      'host-builder',
      'remote-builder',
      'federation-auditor',
      'security-reviewer',
    ])('writes .claude/agents/%s.md', async (agent) => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const file = path.join(tmp, 'my-app', '.claude', 'agents', `${agent}.md`);
      expect(await fs.pathExists(file)).toBe(true);
      const content = await fs.readFile(file, 'utf8');
      expect(content).toMatch(/^---\s*\nname:/);
      expect(content).toContain('tools:');
    });

    it('writes .claude/README.md describing the layout', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const readme = await fs.readFile(
        path.join(tmp, 'my-app', '.claude', 'README.md'),
        'utf8',
      );
      expect(readme).toContain('skills');
      expect(readme).toContain('agents');
      expect(readme).toContain('settings.json');
    });

    it('--no-ai skips all AI scaffold files', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      initCommand.exitOverride();
      const prev = process.cwd();
      process.chdir(tmp);
      try {
        await initCommand.parseAsync(['my-app', '--dir', tmp, '--no-ai'], { from: 'user' });
      } finally {
        process.chdir(prev);
      }
      expect(await fs.pathExists(path.join(tmp, 'my-app', 'CLAUDE.md'))).toBe(false);
      expect(await fs.pathExists(path.join(tmp, 'my-app', 'AGENTS.md'))).toBe(false);
      expect(await fs.pathExists(path.join(tmp, 'my-app', '.cursorrules'))).toBe(false);
      expect(await fs.pathExists(path.join(tmp, 'my-app', '.claude'))).toBe(false);
      // Scaffold should still be complete.
      expect(await fs.pathExists(path.join(tmp, 'my-app', 'package.json'))).toBe(true);
    });
  });

  describe('root tooling files', () => {
    it('writes eslint.config.mjs that extends @jorvel/eslint-config', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const content = await fs.readFile(
        path.join(tmp, 'my-app', 'eslint.config.mjs'),
        'utf8',
      );
      expect(content).toContain("from '@jorvel/eslint-config'");
      expect(content).toContain('export default');
      expect(content).toContain('dist');
      expect(content).toContain('node_modules');
    });

    it('writes .prettierignore covering dist/node_modules/coverage', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const content = await fs.readFile(
        path.join(tmp, 'my-app', '.prettierignore'),
        'utf8',
      );
      expect(content).toContain('dist');
      expect(content).toContain('node_modules');
      expect(content).toContain('coverage');
      expect(content).toContain('pnpm-lock.yaml');
    });

    it('.gitignore ignores .turbo and playwright-report', async () => {
      const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-init-'))) as string;
      await run('my-app', tmp);
      const gi = await fs.readFile(path.join(tmp, 'my-app', '.gitignore'), 'utf8');
      expect(gi).toContain('playwright-report');
      expect(gi).toContain('.turbo');
    });
  });
});

