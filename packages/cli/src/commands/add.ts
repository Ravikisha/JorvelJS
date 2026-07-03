import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { findHostApp, discoverApps } from '../discovery.js';
import { toFederationName } from './federation.js';
import { writeRemotesDts } from '../remotes-dts.js';
import { JorvelCliError } from '../errors.js';
import { attachAddDb } from './add-db.js';

type FederationConfig = {
  name?: string;
  filename?: string;
  remotes?: Record<string, string>;
  shared?: Record<string, unknown>;
};

type RoutesHost = {
  host?: string;
  routes?: Array<{ path: string; remote: string; module?: string }>;
};

const NAME_RE = /^[a-z][a-z0-9-]*$/;

/** Best-effort codemod: wire the remote into the host bootstrap's REMOTES map + nav. */
async function patchBootstrap(hostDir: string, name: string): Promise<boolean> {
  for (const ext of ['tsx', 'jsx', 'ts', 'js']) {
    const file = path.join(hostDir, 'src', `bootstrap.${ext}`);
    if (!(await fs.pathExists(file))) continue;
    let src = await fs.readFile(file, 'utf8');
    if (src.includes(`import('${name}/App')`)) return true; // already wired

    const entry = `  ${JSON.stringify(name)}: () => import('${name}/App'),`;
    // Insert into `const REMOTES = { … };`
    const remotesIdx = src.indexOf('const REMOTES');
    if (remotesIdx !== -1) {
      const open = src.indexOf('{', remotesIdx);
      if (open !== -1) {
        src = src.slice(0, open + 1) + '\n' + entry + src.slice(open + 1);
      }
    }
    // Insert a nav link before </nav> (first occurrence).
    const navClose = src.indexOf('</nav>');
    if (navClose !== -1) {
      const link = `          <NavLink to="/${name}" label="${name}" />\n        `;
      src = src.slice(0, navClose) + link + src.slice(navClose);
    }
    await fs.writeFile(file, src, 'utf8');
    return remotesIdx !== -1;
  }
  return false;
}

const addRemoteCommand = new Command('remote')
  .description('Wire an existing/remote app into the host (federation + routes + types).')
  .argument('<name>', 'Remote app name (the import-specifier key, e.g. dashboard)')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--port <n>', 'Remote dev-server port (used to build the default URL)', (v) => Number(v))
  .option('--url <url>', 'remoteEntry.js URL (default: http://localhost:<port>/remoteEntry.js)')
  .action(async (name: string, opts: { dir: string; port?: number; url?: string }) => {
    const workspaceDir = path.resolve(opts.dir);
    if (!NAME_RE.test(name)) {
      throw new JorvelCliError(`Invalid remote name "${name}".`, {
        code: 'ADD-001',
        hint: 'Use lowercase letters, digits, and hyphens; must start with a letter.',
      });
    }

    const host = await findHostApp(workspaceDir);
    if (!host) {
      throw new JorvelCliError('No host app found.', {
        code: 'ADD-002',
        hint: 'Generate one first: `jorvel generate host shell`.',
      });
    }

    // Derive a port/url if not given: next free after the highest existing port.
    const apps = await discoverApps(workspaceDir);
    const maxPort = apps.reduce((m, a) => Math.max(m, a.meta.port || 0), 3000);
    const port = opts.port ?? maxPort + 1;
    const url = opts.url ?? `http://localhost:${port}/remoteEntry.js`;

    // 1. Host federation.json — add the remote (sanitized global @ url).
    const fedPath = path.join(host.dir, 'jorvel.federation.json');
    const fed: FederationConfig = (await fs.pathExists(fedPath))
      ? ((await fs.readJson(fedPath)) as FederationConfig)
      : { name: toFederationName(host.meta.name), filename: 'remoteEntry.js' };
    fed.remotes = fed.remotes ?? {};
    fed.remotes[name] = `${toFederationName(name)}@${url}`;
    await fs.outputFile(fedPath, JSON.stringify(fed, null, 2) + '\n', 'utf8');

    // 2. Host routes manifest — add a /<name>/* route if absent.
    const routesPath = path.join(host.dir, 'jorvel.routes.host.json');
    const routes: RoutesHost = (await fs.pathExists(routesPath))
      ? ((await fs.readJson(routesPath)) as RoutesHost)
      : { host: host.meta.name, routes: [] };
    routes.routes = routes.routes ?? [];
    if (!routes.routes.some((r) => r.remote === name)) {
      routes.routes.push({ path: `/${name}/*`, remote: name, module: './App' });
    }
    await fs.outputFile(routesPath, JSON.stringify(routes, null, 2) + '\n', 'utf8');

    // 3. Regenerate remotes.d.ts from the updated wiring.
    const { remotes } = await writeRemotesDts(host.dir);

    // 4. Best-effort bootstrap wiring.
    const patched = await patchBootstrap(host.dir, name);

    const rel = (p: string) => path.relative(workspaceDir, p);
    console.log(kleur.green(`Wired remote "${name}" into host "${host.meta.name}":`));
    console.log(kleur.gray(`  - ${rel(fedPath)} (remotes.${name})`));
    console.log(kleur.gray(`  - ${rel(routesPath)} (/${name}/*)`));
    console.log(kleur.gray(`  - ${rel(path.join(host.dir, 'src/remotes.d.ts'))} (${remotes.length} remote type decl)`));
    if (patched) {
      console.log(kleur.gray(`  - ${rel(path.join(host.dir, 'src'))}/bootstrap.* (REMOTES map + NavLink)`));
    } else {
      console.log(
        kleur.yellow(
          `  ! Could not auto-edit the host bootstrap. Add manually to its REMOTES map:\n` +
            `      ${name}: () => import('${name}/App'),`,
        ),
      );
    }
    const exists = apps.some((a) => a.meta.name === name);
    if (!exists) {
      console.log(
        kleur.cyan(`\nNote: no local app "${name}" found. Scaffold it with: jorvel generate remote ${name}`),
      );
    }
  });

export const addCommand = new Command('add')
  .description('Add and wire pieces into an existing workspace.')
  .addCommand(addRemoteCommand);

// `jorvel add db [app]` — Drizzle ORM backend generator.
attachAddDb(addCommand);
