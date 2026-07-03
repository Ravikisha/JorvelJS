#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initCommand } from './commands/init.js';
import { generateCommand } from './commands/generate.js';
import { devCommand } from './commands/dev.js';
import { buildCommand } from './commands/build.js';
import { federationCommand } from './commands/federation.js';
import { routesCommand } from './commands/routes.js';
import { ssrCommand } from './commands/ssr.js';
import { typecheckCommand } from './commands/typecheck.js';
import { ciCommand } from './commands/ci.js';
import { perfCommand } from './commands/perf.js';
import { lazyCommand } from './commands/lazy.js';
import { imageCommand } from './commands/image.js';
import { scaffoldCommand } from './commands/scaffold.js';
import { diagnoseCommand } from './commands/diagnose.js';
import { infoCommand } from './commands/info.js';
import { canaryCommand } from './commands/canary.js';
import { deployCommand } from './commands/deploy.js';
import { lintCommand } from './commands/lint.js';
import { testCommand } from './commands/test.js';
import { envCommand } from './commands/env.js';
import { swCommand } from './commands/sw.js';
import { analyzeCommand } from './commands/analyze.js';
import { loadtestCommand } from './commands/loadtest.js';
import { perfDashboardCommand } from './commands/perf-dashboard.js';
import { routeEditorCommand } from './commands/route-editor.js';
import { adapterCommand } from './commands/frameworks.js';
import { splitCommand } from './commands/split.js';
import { typedocCommand } from './commands/typedoc.js';
import { schemaCommand } from './commands/schema.js';
import { configCommand } from './commands/config.js';
import { addCommand } from './commands/add.js';
import { turboCommand } from './commands/turbo.js';
import { migrateCommand } from './commands/migrate.js';
import { printCliError } from './errors.js';

export const program = new Command();

function getCliVersion(): string {
  try {
    const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch (err) {
    if (process.env['JORVEL_DEBUG'] === '1') {
      // eslint-disable-next-line no-console
      console.error('[jorvel] could not read own package.json:', (err as Error).message);
    }
    return '0.0.0';
  }
}

/** Common commands surfaced by the interactive picker (bare `jorvel` on a TTY). */
export const PICKER_COMMANDS: Array<{ name: string; hint: string }> = [
  { name: 'dev', hint: 'run all apps in dev' },
  { name: 'generate', hint: 'scaffold a host / remote / storybook' },
  { name: 'build', hint: 'production build' },
  { name: 'federation', hint: 'federation config / diff / impact / canary' },
  { name: 'add', hint: 'wire a remote or add a database' },
  { name: 'diagnose', hint: 'check workspace health' },
  { name: 'info', hint: 'environment diagnostic bundle' },
  { name: 'deploy', hint: 'package for a deploy target' },
];

program
  .name('jorvel')
  .description('JORVEL CLI (micro-frontend framework)')
  .version(getCliVersion())
  .option('--cwd <path>', 'Workspace root directory (overrides --dir on subcommands)')
  .option('-v, --verbose', 'Verbose logging (sets JORVEL_DEBUG=1)', false)
  .option('--dry-run', 'Print what would be done without making changes (where supported)', false)
  .hook('preAction', (cmd) => {
    const opts = cmd.opts() as { verbose?: boolean; cwd?: string };
    if (opts.verbose) process.env['JORVEL_DEBUG'] = '1';
    if (opts.cwd) {
      // Don't chdir — surface the value through env so subcommands can opt in.
      process.env['JORVEL_CWD'] = path.resolve(opts.cwd);
    }
  });

// Bare `jorvel` on a TTY → interactive command picker; else print help.
program.action(async () => {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    program.help();
    return;
  }
  const { select } = await import('@inquirer/prompts');
  const chosen = await select({
    message: 'What do you want to do?',
    choices: PICKER_COMMANDS.map((c) => ({ name: `${c.name.padEnd(12)} ${c.hint}`, value: c.name })),
  });
  const cmd = program.commands.find((c) => c.name() === chosen);
  // Show the chosen command's usage so the user can copy the exact invocation.
  console.log('\n' + (cmd ? cmd.helpInformation() : `Run: jorvel ${chosen} --help`));
});

program.addCommand(initCommand);
program.addCommand(generateCommand);
program.addCommand(devCommand);
program.addCommand(buildCommand);
program.addCommand(federationCommand);
program.addCommand(routesCommand);
program.addCommand(ssrCommand);
program.addCommand(typecheckCommand);
program.addCommand(ciCommand);
program.addCommand(perfCommand);
program.addCommand(lazyCommand);
program.addCommand(imageCommand);
program.addCommand(scaffoldCommand);
program.addCommand(diagnoseCommand);
program.addCommand(infoCommand);
program.addCommand(canaryCommand);
program.addCommand(deployCommand);
program.addCommand(lintCommand);
program.addCommand(testCommand);
program.addCommand(envCommand);
program.addCommand(swCommand);
program.addCommand(analyzeCommand);
program.addCommand(loadtestCommand);
program.addCommand(perfDashboardCommand);
program.addCommand(routeEditorCommand);
program.addCommand(adapterCommand);
program.addCommand(splitCommand);
program.addCommand(typedocCommand);
program.addCommand(schemaCommand);
program.addCommand(configCommand);
program.addCommand(addCommand);
program.addCommand(turboCommand);
program.addCommand(migrateCommand);

program.showHelpAfterError('(use --help)');
program.showSuggestionAfterError(true);

const isDirectInvocation = (() => {
  try {
    const argv1 = process.argv[1] ?? '';
    if (!argv1) return false;
    const a = fs.realpathSync(argv1);
    const b = fs.realpathSync(fileURLToPath(import.meta.url));
    return path.resolve(a) === path.resolve(b);
  } catch {
    // Symlink / shim cases (npm-link, pnpm.cmd, tsx) — fall back to a looser
    // check that simply looks for our bin name in argv[1].
    try {
      return /[\\/]jorvel(\.[cm]?js)?$/.test(process.argv[1] ?? '');
    } catch {
      return false;
    }
  }
})();

if (isDirectInvocation) {
  process.on('unhandledRejection', (reason) => {
    printCliError(reason);
  });
  process.on('uncaughtException', (err) => {
    printCliError(err);
    process.exit(1);
  });
  void (async () => {
    try {
      await program.parseAsync(process.argv);
    } catch (err) {
      printCliError(err);
    }
  })();
}
