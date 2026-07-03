import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { input, confirm, number, checkbox } from '@inquirer/prompts';

import { getTailwindDefault, loadWorkspaceConfig } from '../config.js';

import { generateCommand } from './generate.js';
import { federationCommand } from './federation.js';
import { routesCommand } from './routes.js';

type ScaffoldOpts = {
  dir: string;
  yes?: boolean;
};

async function readWorkspaceTailwindDefault(workspaceDir: string): Promise<boolean> {
  try {
    const { cfg } = await loadWorkspaceConfig(workspaceDir);
    return getTailwindDefault(cfg) ?? false;
  } catch {
    return false;
  }
}

async function runSubcommand(cmd: Command, args: string[], workspaceDir: string) {
  cmd.exitOverride();
  const prev = process.cwd();
  process.chdir(workspaceDir);
  try {
    await cmd.parseAsync(args, { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

async function writeHostRemoteSmokeTest(workspaceDir: string, hostName: string, remoteNames: string[]) {
  const testsDir = path.join(workspaceDir, 'tests');
  await fs.ensureDir(testsDir);

  const testFile = path.join(testsDir, 'mfe-smoke.test.ts');
  await fs.outputFile(
    testFile,
    [
      "import { describe, it, expect } from 'vitest';",
      "import path from 'node:path';",
      "import { fileURLToPath } from 'node:url';",
      "import fs from 'fs-extra';",
      '',
      '// Resolve apps/ relative to this test file so the suite survives a repo',
      '// clone/move/CI (no absolute paths baked in at scaffold time).',
      "const appsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps');",
      '',
      "describe('microfrontend scaffold smoke', () => {",
      "  it('host and remotes exist with jorvel.app.json', async () => {",
      `    const apps = ${JSON.stringify([hostName, ...remoteNames])};`,
      '    for (const name of apps) {',
      '      const dir = path.join(appsDir, name);',
      '      expect(await fs.pathExists(dir)).toBe(true);',
      '      expect(await fs.pathExists(path.join(dir, \"jorvel.app.json\"))).toBe(true);',
      '      expect(await fs.pathExists(path.join(dir, \"rspack.config.mjs\"))).toBe(true);',
      '      expect(await fs.pathExists(path.join(dir, \"src\", \"mf-shim.js\"))).toBe(true);',
      '    }',
      '  });',
      '',
      "  it('federation config is generated for host and remotes', async () => {",
      `    const apps = ${JSON.stringify([hostName, ...remoteNames])};`,
      '    for (const name of apps) {',
      '      const dir = path.join(appsDir, name);',
      '      expect(await fs.pathExists(path.join(dir, \"jorvel.federation.json\"))).toBe(true);',
      '    }',
      '  });',
      '});',
      '',
    ].join('\n'),
    'utf8'
  );

  // Ensure root has vitest available. This repo already uses vitest in packages/cli,
  // but a newly initialized user workspace needs a devDep and script.
  const pkgPath = path.join(workspaceDir, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const pkg = (await fs.readJson(pkgPath)) as any;
    pkg.devDependencies = pkg.devDependencies ?? {};
    pkg.devDependencies.vitest = pkg.devDependencies.vitest ?? '^2.1.9';
    pkg.scripts = pkg.scripts ?? {};
    pkg.scripts['test:smoke'] = pkg.scripts['test:smoke'] ?? 'vitest run tests/mfe-smoke.test.ts';
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  }
}

const scaffoldAppCommand = new Command('app')
  .description('Create a host + one or more remotes with optional Tailwind and a smoke test')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('-y, --yes', 'Skip prompts and use defaults', false)
  .action(async (opts: ScaffoldOpts) => {
    const workspaceDir = path.resolve(opts.dir);
    const interactive = !opts.yes && Boolean(process.stdout.isTTY);

    const defaultTailwind = await readWorkspaceTailwindDefault(workspaceDir);

    const hostName = (interactive
      ? await input({ message: 'Host app name', default: 'shell' })
      : 'shell') as string;

    const remoteCount = (interactive
      ? await number({ message: 'How many remotes?', default: 1, min: 1, max: 8 })
      : 1) as number;

    const remoteNames: string[] = [];
    for (let i = 0; i < remoteCount; i++) {
      const name = interactive
        ? await input({ message: `Remote #${i + 1} name`, default: i === 0 ? 'dashboard' : `remote-${i + 1}` })
        : i === 0
          ? 'dashboard'
          : `remote-${i + 1}`;
      remoteNames.push(name);
    }

    const basePort = (interactive
      ? await number({ message: 'Host port', default: 3000, min: 1, max: 65535 })
      : 3000) as number;

    const enableTailwind = interactive
      ? await confirm({ message: 'Enable Tailwind CSS?', default: defaultTailwind })
      : defaultTailwind;

    const selected = interactive
      ? await checkbox({
          message: 'Optional extras',
          choices: [
            { name: 'Generate jorvel.routes.json (file-based routes)', value: 'routes', checked: true },
            { name: 'Generate jorvel.federation.json (Module Federation wiring)', value: 'federation', checked: true },
            { name: 'Add a workspace smoke test (Vitest)', value: 'smoke', checked: true },
          ],
        })
      : (['routes', 'federation', 'smoke'] as const);

    console.log(kleur.cyan(`Scaffolding host + remotes in ${workspaceDir}`));

    // Host
    await runSubcommand(generateCommand, ['host', hostName, '--dir', workspaceDir, '--port', String(basePort), ...(enableTailwind ? ['--tailwind'] : [])], workspaceDir);

    // Remotes
    const startingRemotePort = basePort + 1;
    for (let i = 0; i < remoteNames.length; i++) {
      const port = startingRemotePort + i;
      const remoteName = remoteNames[i] ?? `remote-${i + 1}`;
      await runSubcommand(
        generateCommand,
        ['remote', remoteName, '--dir', workspaceDir, '--port', String(port), ...(enableTailwind ? ['--tailwind'] : [])],
        workspaceDir
      );
    }

    if (selected.includes('federation')) {
      await runSubcommand(federationCommand, ['--dir', workspaceDir], workspaceDir);
    }

    if (selected.includes('routes')) {
      await runSubcommand(routesCommand, ['--dir', workspaceDir], workspaceDir);
    }

    if (selected.includes('smoke')) {
      await writeHostRemoteSmokeTest(workspaceDir, hostName, remoteNames);
    }

    console.log(kleur.green('Scaffold complete.'));
    console.log(kleur.gray('Next:'));
    console.log(kleur.gray(`  pnpm -C ${workspaceDir} install`));
    console.log(kleur.gray(`  pnpm -C ${workspaceDir} dev`));
    console.log(kleur.gray(`  pnpm -C ${workspaceDir} test:smoke`));
  });

export const scaffoldCommand = new Command('scaffold')
  .description('Guided scaffolding for complete microfrontend applications')
  .addCommand(scaffoldAppCommand);
