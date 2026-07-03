import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { execa } from 'execa';

/**
 * `jorvel typecheck [--dir <path>]`
 *
 * Runs `tsc --noEmit` for every workspace package that has a `tsconfig.json`
 * with a `typecheck` script, OR — as a fallback — invokes `tsc --noEmit`
 * directly.
 *
 * Packages checked:
 *   - libs/*      (all lib packages)
 *   - packages/*  (CLI etc.)
 *   - apps/*      (generated apps)
 */

type PackageJson = {
  name?: string;
  scripts?: Record<string, string>;
};

async function findTypecheckablePackages(workspaceDir: string): Promise<string[]> {
  const roots = ['libs', 'packages', 'apps'];
  const dirs: string[] = [];

  for (const root of roots) {
    const rootDir = path.join(workspaceDir, root);
    if (!(await fs.pathExists(rootDir))) continue;

    const entries = await fs.readdir(rootDir);
    for (const entry of entries) {
      const dir = path.join(rootDir, entry);
      const tsconfig = path.join(dir, 'tsconfig.json');
      if (await fs.pathExists(tsconfig)) {
        dirs.push(dir);
      }
    }
  }

  return dirs;
}

async function typecheckPackage(
  packageDir: string,
): Promise<{ dir: string; ok: boolean; output: string }> {
  // Prefer the `typecheck` script from package.json; fall back to tsc --noEmit.
  const pkgJsonPath = path.join(packageDir, 'package.json');
  let useScript = false;
  let pkgName = path.basename(packageDir);

  if (await fs.pathExists(pkgJsonPath)) {
    const pkg = (await fs.readJson(pkgJsonPath)) as PackageJson;
    if (pkg.name) pkgName = pkg.name;
    if (pkg.scripts?.['typecheck']) useScript = true;
  }

  // Run tsc via `pnpm exec` rather than the .bin/tsc sh-shim: the shim isn't
  // executable on Windows, and spawning `tsc.cmd` with shell:false would EINVAL
  // on Node >=20.12. pnpm resolves the local tsc cross-platform.
  const args = useScript ? ['run', 'typecheck'] : ['exec', 'tsc', '--noEmit'];

  try {
    await execa('pnpm', args, { cwd: packageDir, reject: true });
    return { dir: pkgName, ok: true, output: '' };
  } catch (err) {
    // tsc writes diagnostics to STDOUT (not stderr) — capture both, else the
    // user sees a red ✗ with no detail.
    const e = err as { stdout?: string; stderr?: string };
    const output = [e?.stdout, e?.stderr].filter(Boolean).join('\n').trim() || String(err);
    return { dir: pkgName, ok: false, output };
  }
}

export const typecheckCommand = new Command('typecheck')
  .description(
    'Run tsc --noEmit across all workspace packages (libs, packages, apps)'
  )
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--fail-fast', 'Stop after the first package with type errors', false)
  .action(async (opts: { dir: string; failFast: boolean }) => {
    const workspaceDir = path.resolve(opts.dir);

    const packages = await findTypecheckablePackages(workspaceDir);

    if (packages.length === 0) {
      console.log(kleur.yellow('No tsconfig.json files found in libs/, packages/, or apps/.'));
      return;
    }

    console.log(kleur.cyan(`Type-checking ${packages.length} package(s)…\n`));

    let failCount = 0;

    for (const pkg of packages) {
      const label = path.relative(workspaceDir, pkg) || path.basename(pkg);
      process.stdout.write(`  ${label} … `);

      const result = await typecheckPackage(pkg);

      if (result.ok) {
        console.log(kleur.green('✓'));
      } else {
        console.log(kleur.red('✗'));
        console.error(kleur.dim(result.output.trim()));
        failCount++;
        if (opts.failFast) break;
      }
    }

    console.log('');

    if (failCount === 0) {
      console.log(kleur.green(`All ${packages.length} package(s) passed type-checking.`));
    } else {
      console.error(kleur.red(`${failCount} package(s) had type errors.`));
      process.exitCode = 1;
    }
  });
