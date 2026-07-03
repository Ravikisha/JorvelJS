import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { loadWorkspaceConfig } from '../config.js';
import { findHostApp } from '../discovery.js';

type Target = 'vercel' | 'cloudflare' | 'netlify' | 'node' | 'docker' | 'github-pages';

interface ScaffoldDeployOptions {
  cwd: string;
  dryRun?: boolean;
  log?: (msg: string) => void;
}

interface ScaffoldDeployResult {
  files: { dest: string; written: boolean }[];
  nextHint: string;
}

interface DeployAdapterModule {
  scaffoldDeploy: (opts: ScaffoldDeployOptions) => Promise<ScaffoldDeployResult>;
  deployTarget?: string;
}

const ADAPTER_PACKAGES: Record<Target, string | null> = {
  vercel: '@jorvel/adapter-vercel',
  cloudflare: '@jorvel/adapter-cloudflare',
  node: '@jorvel/adapter-node',
  docker: '@jorvel/adapter-node',
  netlify: null, // No adapter-netlify yet — use inline scaffold.
  'github-pages': null, // static export → inline scaffold.
};

export const deployCommand = new Command('deploy')
  .description('Package the workspace for a deploy target (delegates to @jorvel/adapter-* packages).')
  .option('--target <target>', 'vercel | cloudflare | netlify | node | docker | github-pages')
  .option('--cwd <dir>', 'Workspace root', process.cwd())
  .option('--dry-run', 'Print actions but do not write files')
  .action(async (opts: { target?: Target; cwd: string; dryRun?: boolean }) => {
    const cwd = path.resolve(opts.cwd);
    const { cfg } = await loadWorkspaceConfig(cwd);
    const target = opts.target ?? cfg?.deploy?.target;

    if (!target) {
      console.error(kleur.red('deploy: no target. Pass --target or set deploy.target in jorvel.config.'));
      process.exit(1);
    }

    console.log(kleur.bold(`jorvel deploy -> ${target}`));

    const log = (msg: string) => console.log(kleur.green(msg));
    const adapterPkg = ADAPTER_PACKAGES[target];

    if (adapterPkg) {
      const mod = await tryLoadAdapter(adapterPkg);
      if (mod) {
        const scaffoldOpts: ScaffoldDeployOptions = { cwd, log };
        if (opts.dryRun !== undefined) scaffoldOpts.dryRun = opts.dryRun;
        const result = await mod.scaffoldDeploy(scaffoldOpts);
        if (result.files.every((f) => !f.written)) {
          console.log(kleur.dim('  (no files written; all targets exist)'));
        }
        console.log(kleur.dim(`  next: ${result.nextHint}`));
        return;
      }
      console.log(
        kleur.yellow(
          `  ${adapterPkg} not installed; using built-in scaffold. Install ${adapterPkg} to customize the deploy.`,
        ),
      );
    }

    // Fallback: built-in inline scaffolds. Resolve the host app's dist dir so we
    // don't bake in `apps/shell` when the host lives elsewhere.
    const hostDist = await hostDistDir(cwd, cfg?.appsDir);
    switch (target) {
      case 'vercel':
        return scaffoldVercel(cwd, hostDist, opts.dryRun);
      case 'cloudflare':
        return scaffoldCloudflare(cwd, hostDist, opts.dryRun);
      case 'netlify':
        return scaffoldNetlify(cwd, hostDist, opts.dryRun);
      case 'node':
      case 'docker':
        return scaffoldNode(cwd, hostDist, opts.dryRun);
      case 'github-pages':
        return scaffoldGitHubPages(cwd, hostDist, opts.dryRun);
    }
  });

/**
 * GitHub Pages (static export). Emits a Pages deploy workflow + a `.nojekyll`
 * marker so `_`-prefixed asset files aren't dropped by Jekyll. Best for
 * static-export sites (SPA host + prebuilt remotes on the same origin).
 */
async function scaffoldGitHubPages(cwd: string, hostDist: string, dryRun?: boolean): Promise<void> {
  await writeIfMissing(path.join(cwd, hostDist, '.nojekyll'), '', dryRun);
  await writeIfMissing(
    path.join(cwd, '.github', 'workflows', 'pages.yml'),
    `name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: ${hostDist} }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: \${{ steps.deployment.outputs.page_url }} }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
`,
    dryRun,
  );
  console.log(kleur.dim('  next: enable Pages (Settings → Pages → Source: GitHub Actions), then push to main.'));
  console.log(kleur.dim('  note: set a base path for project pages (jorvel build --base /<repo>/).'));
}

/**
 * Posix-relative path to the host app's `dist` output (e.g. `apps/shell/dist`),
 * derived from the discovered host app. Falls back to `apps/shell/dist`.
 */
async function hostDistDir(cwd: string, appsSubdir?: string): Promise<string> {
  const host = await findHostApp(cwd, appsSubdir ?? 'apps').catch(() => null);
  const rel = host ? path.relative(cwd, host.dir) : path.join(appsSubdir ?? 'apps', 'shell');
  return `${rel.replace(/\\/g, '/')}/dist`;
}

async function tryLoadAdapter(pkg: string): Promise<DeployAdapterModule | null> {
  // Edge adapters (vercel/cloudflare) expose the scaffold on a `/deploy` subpath
  // so their runtime entry stays free of Node builtins; the node adapter keeps it
  // at the package root. Try the subpath first, then fall back to the root.
  for (const specifier of [`${pkg}/deploy`, pkg]) {
    try {
      const mod = (await import(specifier)) as Partial<DeployAdapterModule>;
      if (typeof mod.scaffoldDeploy === 'function') {
        return mod as DeployAdapterModule;
      }
    } catch {
      // try the next specifier
    }
  }
  return null;
}

async function writeIfMissing(file: string, content: string, dryRun?: boolean): Promise<void> {
  if (await fs.pathExists(file)) {
    console.log(kleur.dim(`  skip  ${path.relative(process.cwd(), file)} (exists)`));
    return;
  }
  console.log(kleur.green(`  write ${path.relative(process.cwd(), file)}`));
  if (!dryRun) {
    await fs.ensureDir(path.dirname(file));
    await fs.writeFile(file, content, 'utf8');
  }
}

async function scaffoldVercel(cwd: string, hostDist: string, dryRun?: boolean): Promise<void> {
  await writeIfMissing(
    path.join(cwd, 'vercel.json'),
    JSON.stringify(
      {
        buildCommand: 'pnpm build',
        outputDirectory: hostDist,
        framework: null,
        rewrites: [{ source: '/jorvel/remotes/:name/:path*', destination: '/:path*' }],
        headers: [
          {
            source: '/assets/(.*)',
            headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
          },
        ],
      },
      null,
      2,
    ) + '\n',
    dryRun,
  );
  console.log(kleur.dim('  next: `vercel deploy`'));
}

async function scaffoldCloudflare(cwd: string, hostDist: string, dryRun?: boolean): Promise<void> {
  await writeIfMissing(
    path.join(cwd, 'wrangler.toml'),
    `name = "jorvel-shell"
main = "${hostDist}/worker.js"
compatibility_date = "2025-01-01"

[build]
command = "pnpm build"
`,
    dryRun,
  );
  console.log(kleur.dim(`  next: \`wrangler deploy\` or \`wrangler pages deploy ${hostDist}\``));
}

async function scaffoldNetlify(cwd: string, hostDist: string, dryRun?: boolean): Promise<void> {
  await writeIfMissing(
    path.join(cwd, 'netlify.toml'),
    `[build]
  command = "pnpm build"
  publish = "${hostDist}"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`,
    dryRun,
  );
  console.log(kleur.dim('  next: `netlify deploy --prod`'));
}

async function scaffoldNode(cwd: string, hostDist: string, dryRun?: boolean): Promise<void> {
  await writeIfMissing(
    path.join(cwd, 'Dockerfile'),
    `FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
COPY . .
RUN pnpm install --frozen-lockfile && pnpm -r build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["node", "${hostDist}/server.js"]
`,
    dryRun,
  );
  console.log(kleur.dim('  next: `docker build -t shell . && docker run -p 3000:3000 shell`'));
}
