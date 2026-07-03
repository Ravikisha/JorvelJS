import { Command } from 'commander';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import kleur from 'kleur';
import { buildCiWorkflow, buildPreviewWorkflow, buildDeployWorkflow } from './ci.js';
import { confirm, select } from '@inquirer/prompts';
import { writeAiAgentScaffold } from '../ai-scaffold.js';
import { writeWorkspaceExtras } from '../scaffold-extras.js';

const execFileP = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(HERE, '../../templates');

const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const PM_VERSION: Record<PackageManager, string> = {
  pnpm: 'pnpm@9.15.5',
  npm: 'npm@10.9.0',
  yarn: 'yarn@4.6.0',
  bun: 'bun@1.1.42',
};

/** Build the run-command for a script under the chosen package manager. */
function pmRun(pm: PackageManager, script: string): string {
  if (pm === 'npm') return `npm run ${script}`;
  if (pm === 'yarn') return `yarn ${script}`;
  if (pm === 'bun') return `bun run ${script}`;
  return `pnpm ${script}`;
}

function pmInstall(pm: PackageManager): string {
  return pm === 'bun' ? 'bun install' : `${pm} install`;
}

const TEMPLATES = ['host-remote', 'saas', 'blank'] as const;
type Template = (typeof TEMPLATES)[number];

/** App generation steps suggested per template (printed in the success screen). */
function templateApps(template: Template): Array<{ cmd: string; note: string }> {
  if (template === 'blank') return [];
  if (template === 'saas') {
    return [
      { cmd: 'generate host shell --port 3000', note: 'host shell' },
      { cmd: 'generate remote dashboard --port 3001', note: 'authed dashboard remote' },
      { cmd: 'generate remote marketing --port 3002', note: 'public marketing remote' },
    ];
  }
  // host-remote (default)
  return [
    { cmd: 'generate host shell --port 3000', note: 'host shell' },
    { cmd: 'generate remote dashboard --port 3001', note: 'first remote' },
  ];
}

async function writeJson(filePath: string, obj: unknown) {
  await fs.outputFile(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

async function writeText(filePath: string, content: string) {
  await fs.outputFile(filePath, content, 'utf8');
}

async function copyTemplateAsset(rel: string, dest: string) {
  const src = path.join(TEMPLATES_DIR, 'assets', rel);
  await fs.ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

async function isGitAvailable(): Promise<boolean> {
  try {
    await execFileP('git', ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function runGitInit(cwd: string): Promise<void> {
  await execFileP('git', ['init', '--initial-branch=main'], { cwd }).catch(async () => {
    // Older git that does not support --initial-branch: fall back.
    await execFileP('git', ['init'], { cwd });
  });
}

async function ensureEmptyDir(dir: string) {
  const exists = await fs.pathExists(dir);
  if (!exists) return;

  const entries = await fs.readdir(dir);
  // Allow creating into an existing empty directory.
  if (entries.length === 0) return;

  throw new Error(`Target directory is not empty: ${dir}`);
}

export const initCommand = new Command('init')
  .description('Initialize a new JORVEL workspace (monorepo)')
  .argument('<name>', 'Folder name for the new workspace')
  .option('-d, --dir <path>', 'Parent directory to create the workspace in', process.cwd())
  .option('-y, --yes', 'Skip prompts and use defaults', false)
  .option('--tailwind', 'Enable Tailwind CSS for generated apps (can also be enabled per-app in generate)', false)
  .option('--pm <manager>', 'Package manager: pnpm | npm | yarn | bun', 'pnpm')
  .option('--template <name>', 'Starter template: host-remote | saas | blank', 'host-remote')
  .option('--license <spdx>', 'License to write: MIT | Apache-2.0 | none', 'MIT')
  .option('--no-git', 'Skip running `git init` after scaffolding')
  .option('--no-ai', 'Skip AI coding-agent config (CLAUDE.md, .claude/, .cursorrules, copilot-instructions.md)')
  .action(async (name: string, opts: { dir: string; yes?: boolean; tailwind?: boolean; pm?: string; template?: string; license?: string; git?: boolean; ai?: boolean }) => {
    // Workspace name = package.json name + folder name. npm enforces lowercase
    // ASCII, may start with a letter or digit, may contain `.`/`_`/`-`, max 214.
    // We're stricter: must start with a letter so the folder is a valid JS
    // identifier prefix and the npm package name works without a scope.
    const NAME_RE = /^[a-z][a-z0-9-]{0,213}$/;
    if (!NAME_RE.test(name)) {
      console.error(
        kleur.red(
          `Invalid workspace name "${name}". Must be lowercase ASCII, start with a letter, and contain only letters, digits, or hyphens (e.g. "my-app", "shop").`,
        ),
      );
      process.exitCode = 1;
      return;
    }
    // Validate up-front flags so a typo fails fast (before scaffolding).
    if (opts.pm && !PACKAGE_MANAGERS.includes(opts.pm as PackageManager)) {
      console.error(kleur.red(`Invalid --pm "${opts.pm}". Use one of: ${PACKAGE_MANAGERS.join(', ')}.`));
      process.exitCode = 1;
      return;
    }
    if (opts.template && !TEMPLATES.includes(opts.template as Template)) {
      console.error(kleur.red(`Invalid --template "${opts.template}". Use one of: ${TEMPLATES.join(', ')}.`));
      process.exitCode = 1;
      return;
    }

    const workspaceDir = path.resolve(opts.dir, name);

    console.log(kleur.cyan(`Creating JORVEL workspace in ${workspaceDir}`));

    await ensureEmptyDir(workspaceDir);
    await fs.ensureDir(workspaceDir);

    // Interactive prompts only when BOTH stdin and stdout are TTYs — piped
    // stdin (CI, tests, here-docs) would hang the inquirer prompts otherwise.
    const interactive =
      !opts.yes && Boolean(process.stdout.isTTY) && Boolean(process.stdin.isTTY);

    const template: Template = interactive
      ? await select<Template>({
          message: 'Starter template?',
          default: (opts.template as Template) ?? 'host-remote',
          choices: [
            { name: 'Host + remote (recommended) — shell + one federated remote', value: 'host-remote' },
            { name: 'SaaS — shell + dashboard + marketing remotes', value: 'saas' },
            { name: 'Blank — workspace only, add apps yourself', value: 'blank' },
          ],
        })
      : ((opts.template as Template) ?? 'host-remote');

    const pm: PackageManager = interactive
      ? await select<PackageManager>({
          message: 'Package manager?',
          default: (opts.pm as PackageManager) ?? 'pnpm',
          choices: PACKAGE_MANAGERS.map((m) => ({ name: m, value: m })),
        })
      : ((opts.pm as PackageManager) ?? 'pnpm');

    const enableTailwind = interactive
      ? await confirm({ message: 'Enable Tailwind CSS support for generated apps?', default: Boolean((opts as any).tailwind) })
      : Boolean((opts as any).tailwind);

    // root package.json
    await writeJson(path.join(workspaceDir, 'package.json'), {
      name,
      private: true,
      packageManager: PM_VERSION[pm],
      engines: { node: '>=20' },
      scripts: {
        // Dev / build
        dev: 'jorvel dev',
        'dev:proxy': 'jorvel dev --proxy-remotes --hmr-remotes',
        build: 'jorvel build',
        'build:apps': 'pnpm -r --filter "./apps/*" build',
        start: 'jorvel ssr serve',
        // Cross-platform clean (no `rm -rf` — fails on Windows shells).
        clean:
          'pnpm -r exec node -e "for (const d of [\'dist\', \'.turbo\', \'node_modules/.cache\']) require(\'fs\').rmSync(d, { recursive: true, force: true })"',

        // Quality
        typecheck: 'jorvel typecheck',
        lint: 'pnpm -r --if-present lint',
        'lint:fix': 'pnpm -r --if-present lint:fix',
        format: 'prettier --write "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"',
        'format:check': 'prettier --check "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}"',

        // Tests
        test: 'pnpm -r --if-present test',
        'test:watch': 'pnpm -r --parallel --if-present test:watch',
        'test:coverage': 'pnpm -r --parallel --if-present test:coverage',

        // Federation + routes
        routes: 'jorvel routes',
        federation: 'jorvel federation',

        // Diagnostics + ship
        perf: 'jorvel perf',
        diagnose: 'jorvel diagnose',
        analyze: 'jorvel analyze',
        deploy: 'jorvel deploy',

        // CI
        'ci:affected': 'jorvel ci affected',
        ci: 'pnpm typecheck && pnpm lint && pnpm test && pnpm build',

        // Versioning (Changesets)
        changeset: 'changeset',
        version: 'changeset version',
        release: 'changeset publish',

        // Git hooks (husky)
        prepare: 'husky',
      },
      devDependencies: {
        '@jorvel/types': '^0.1.0',
        '@jorvel/eslint-config': '^0.1.0',
        '@jorvel/prettier-config': '^0.1.0',
        '@changesets/cli': '^2.27.11',
        '@commitlint/cli': '^19.6.1',
        '@commitlint/config-conventional': '^19.6.0',
        husky: '^9.1.7',
        'lint-staged': '^15.3.0',
        eslint: '^9.20.0',
        prettier: '^3.4.2',
        typescript: '^5.7.3',
      },
      prettier: '@jorvel/prettier-config',
      // npm / yarn / bun read workspaces from package.json. pnpm uses
      // pnpm-workspace.yaml instead (written below), so skip the field there.
      ...(pm === 'pnpm' ? {} : { workspaces: ['packages/*', 'apps/*', 'libs/*'] }),
    });

    // pnpm reads its workspace globs from a dedicated file. The `catalog:` block
    // centralizes shared dependency versions — apps reference `catalog:` instead
    // of pinning React/etc. in every package.json.
    if (pm === 'pnpm') {
      await writeText(
        path.join(workspaceDir, 'pnpm-workspace.yaml'),
        [
          'packages:',
          '  - "packages/*"',
          '  - "apps/*"',
          '  - "libs/*"',
          '',
          'catalog:',
          '  react: ^18.3.1',
          '  react-dom: ^18.3.1',
          '  typescript: ^5.7.3',
          '  vitest: ^2.1.9',
          '',
        ].join('\n'),
      );
    }

    // Assets — logo (dark + light) + favicon. Logos live under assets/, favicon
    // duplicated into apps/<host>/public/ later by `jorvel generate host`.
    await copyTemplateAsset('logo.svg', path.join(workspaceDir, 'assets', 'logo.svg'));
    await copyTemplateAsset(
      'logo-light.svg',
      path.join(workspaceDir, 'assets', 'logo-light.svg'),
    );
    await copyTemplateAsset(
      'favicon.ico',
      path.join(workspaceDir, 'assets', 'favicon.ico'),
    );
    await copyTemplateAsset(
      'logojorvel.png',
      path.join(workspaceDir, 'assets', 'logojorvel.png'),
    );

    // README with embedded logo
    await writeText(
      path.join(workspaceDir, 'README.md'),
      [
        '<p align="center">',
        '  <img src="assets/logojorvel.png" alt="' + name + '" width="160" height="160">',
        '</p>',
        '',
        '<h1 align="center">' + name + '</h1>',
        '',
        '<p align="center">',
        '  Built with <a href="https://jorveljs.vercel.app">JORVEL</a> — micro-frontends on Rspack Module Federation.',
        '</p>',
        '',
        '---',
        '',
        '## Quickstart',
        '',
        '```sh',
        'pnpm install',
        'pnpm dev              # start every app',
        'pnpm dev:proxy        # host + remotes on same origin (recommended)',
        '```',
        '',
        '## Scripts',
        '',
        '| Script | What it does |',
        '| --- | --- |',
        '| `pnpm dev` | Run every app in parallel |',
        '| `pnpm dev:proxy` | Run host with `--proxy-remotes --hmr-remotes` |',
        '| `pnpm build` | Build every package + app |',
        '| `pnpm start` | Serve the SSR bundle |',
        '| `pnpm test` | Run vitest across the workspace |',
        '| `pnpm test:watch` | Vitest in watch mode |',
        '| `pnpm test:coverage` | Vitest with v8 coverage |',
        '| `pnpm typecheck` | `tsc --noEmit` per package |',
        '| `pnpm lint` | ESLint across the workspace |',
        '| `pnpm lint:fix` | ESLint with `--fix` |',
        '| `pnpm format` | Prettier write |',
        '| `pnpm format:check` | Prettier check |',
        '| `pnpm routes` | Regenerate route manifests |',
        '| `pnpm federation` | Regenerate federation configs |',
        '| `pnpm perf` | Bundle-size + perf budgets |',
        '| `pnpm analyze` | Bundle analyzer |',
        '| `pnpm diagnose` | Workspace health check |',
        '| `pnpm deploy` | Deploy via configured adapter |',
        '| `pnpm ci` | typecheck + lint + test + build |',
        '',
        '## Layout',
        '',
        '```',
        name + '/',
        '├── apps/        # generated host + remotes',
        '├── libs/        # shared libraries (optional)',
        '├── packages/    # internal packages (optional)',
        '├── assets/      # logo + favicon',
        '├── jorvel.config.json',
        '└── tsconfig.base.json',
        '```',
        '',
        '## Generate apps',
        '',
        '```sh',
        'jorvel generate host shell --port 3000',
        'jorvel generate remote dashboard --port 3001',
        'jorvel federation     # wire host -> remote',
        'jorvel routes         # file-based routes manifest',
        '```',
        '',
        '## Docs',
        '',
        '- Full guide: https://jorveljs.vercel.app',
        '- GitHub: https://github.com/Ravikisha/JorvelJS',
        '',
        '## License',
        '',
        'MIT',
        '',
      ].join('\n'),
    );

    // jorvel.config.json — the single source of truth the CLI loads. The bundled
    // JSON Schema gives editors autocomplete + validation, so we deliberately do
    // NOT also emit a jorvel.config.ts (the CLI ships as compiled JS and cannot
    // import raw .ts at runtime; keeping both files only invites silent drift).
    // Need plugins or dynamic config? Add a jorvel.config.mjs — the loader merges
    // it over this JSON.
    await writeJson(path.join(workspaceDir, 'jorvel.config.json'), {
      $schema: './node_modules/@jorvel/types/schemas/jorvel.config.json',
      name,
      appsDir: 'apps',
      libsDir: 'libs',
      features: {
        tailwind: enableTailwind,
        template,
      },
      orchestrator: {
        mode: 'parallel',
        proxyRemotes: false,
        hmrRemotes: false,
      },
      federation: {
        shared: [],
      },
    });

    // Strict shared TypeScript base config
    await writeJson(path.join(workspaceDir, 'tsconfig.base.json'), {
      $schema: 'https://json.schemastore.org/tsconfig',
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'Bundler',
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        noImplicitOverride: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        noPropertyAccessFromIndexSignature: true,
        forceConsistentCasingInFileNames: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
    });

    // ESLint flat config (extends @jorvel/eslint-config)
    await writeText(
      path.join(workspaceDir, 'eslint.config.mjs'),
      [
        "import jorvel from '@jorvel/eslint-config';",
        '',
        'export default [',
        '  ...jorvel,',
        '  {',
        "    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/coverage/**'],",
        '  },',
        '];',
        '',
      ].join('\n'),
    );

    // Prettier ignore
    await writeText(
      path.join(workspaceDir, '.prettierignore'),
      [
        'dist',
        'node_modules',
        '.turbo',
        'coverage',
        'pnpm-lock.yaml',
        '*.tsbuildinfo',
        '',
      ].join('\n'),
    );

    // .gitignore
    await writeText(
      path.join(workspaceDir, '.gitignore'),
      [
        'node_modules',
        'dist',
        '.cache',
        '.turbo',
        '*.local',
        '.env',
        '.env.*',
        '!.env.example',
        'playwright-report',
        'test-results',
        '',
      ].join('\n')
    );

    // .env.example — the .gitignore whitelists it (`!.env.example`); `jorvel env
    // check` validates real env against the keys listed here.
    await writeText(
      path.join(workspaceDir, '.env.example'),
      [
        '# Copy to .env and fill in values. `jorvel env check` / `jorvel diagnose` validate against this file.',
        '# ── Runtime ──',
        'PORT=3000',
        'NODE_ENV=development',
        '',
        '# ── Database (jorvel add db) ──',
        'DATABASE_URL=file:./data/app.db',
        '',
        '# ── Auth ──',
        'SESSION_SECRET=change-me-to-a-long-random-string',
        'CSRF_SECRET=change-me-too',
        '# OAuth (see /docs/auth) — leave blank if unused',
        'GITHUB_CLIENT_ID=',
        'GITHUB_CLIENT_SECRET=',
        'GOOGLE_CLIENT_ID=',
        'GOOGLE_CLIENT_SECRET=',
        '',
        '# ── Telemetry / observability ──',
        'SENTRY_DSN=',
        'POSTHOG_KEY=',
        '',
      ].join('\n'),
    );

    // GitHub Actions CI/CD workflows
    const workflowsDir = path.join(workspaceDir, '.github', 'workflows');
    await fs.ensureDir(workflowsDir);
    const wfOpts = { nodeVersion: '22', packageManager: 'pnpm' };
    await writeText(path.join(workflowsDir, 'ci.yml'), buildCiWorkflow(wfOpts));
    await writeText(path.join(workflowsDir, 'pr-preview.yml'), buildPreviewWorkflow(wfOpts));
    await writeText(
      path.join(workflowsDir, 'deploy.yml'),
      buildDeployWorkflow({ ...wfOpts, target: 'netlify' })
    );

    // AI coding-agent scaffold (skippable with --no-ai). Commander maps --no-ai to opts.ai === false.
    const wantAi = opts.ai !== false;
    if (wantAi) {
      await writeAiAgentScaffold({ workspaceDir, projectName: name });
      console.log(
        kleur.gray(
          'Wrote CLAUDE.md, .claude/{skills,agents}/, .cursorrules, .github/copilot-instructions.md.',
        ),
      );
    }

    // Editor config, GitHub community health files, issue/PR templates, CodeQL +
    // release workflows, Changesets config, and LICENSE.
    const licenseChoice: 'MIT' | 'Apache-2.0' | 'none' =
      opts.license === 'Apache-2.0' || opts.license === 'none' ? opts.license : 'MIT';
    await writeWorkspaceExtras({ workspaceDir, name, pm, license: licenseChoice });
    console.log(
      kleur.gray('Wrote .vscode/, .editorconfig, LICENSE, CONTRIBUTING/SECURITY/CODE_OF_CONDUCT, .github templates, CodeQL + release workflows, .changeset/.'),
    );

    // Git init (skippable with --no-git). Commander maps --no-git to opts.git === false.
    const wantGit = opts.git !== false;
    if (wantGit) {
      if (await isGitAvailable()) {
        try {
          await runGitInit(workspaceDir);
          console.log(kleur.gray('Initialized git repository (main branch).'));
        } catch (err) {
          console.log(
            kleur.yellow(
              `git init failed: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        }
      } else {
        console.log(kleur.yellow('git not found on PATH — skipping `git init`.'));
      }
    }

    // ── "What now?" success screen ────────────────────────────────────────
    const apps = templateApps(template);
    const steps: string[] = [`cd ${name}`, pmInstall(pm)];
    for (const a of apps) steps.push(`jorvel ${a.cmd}`);
    if (apps.length) steps.push('jorvel federation', pmRun(pm, 'dev'));

    const bar = kleur.green('─'.repeat(52));
    console.log('');
    console.log(bar);
    console.log(kleur.green().bold('  ✓ JORVEL workspace ready') + kleur.gray(`  (${template}, ${pm})`));
    console.log(bar);
    console.log(kleur.bold('  Next steps:'));
    steps.forEach((s, i) => console.log(`    ${kleur.cyan(String(i + 1) + '.')} ${s}`));
    if (apps.length) {
      const hostPort = 3000;
      console.log('');
      console.log(`  Then open ${kleur.cyan().underline(`http://localhost:${hostPort}`)} — the host loads its remotes via Module Federation.`);
    } else {
      console.log('');
      console.log(kleur.gray('  Blank workspace — add apps with `jorvel generate host <name>` / `jorvel generate remote <name>`.'));
    }
    console.log('');
    console.log(kleur.gray('  Docs:      https://jorveljs.vercel.app'));
    console.log(kleur.gray('  Community: https://github.com/Ravikisha/JorvelJS/discussions'));
    console.log(bar);
  });
