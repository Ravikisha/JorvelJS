import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const isWindows = process.platform === 'win32';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const exampleDir = join(repoRoot, 'examples', 'basic') + '/';
const cliDist = join(repoRoot, 'packages', 'cli', 'dist', 'index.js');

function spawnChild(cmd, args, cwd, env) {
  // On Windows, pnpm is a .cmd shim. Spawning `pnpm.cmd` with shell:false now
  // throws EINVAL on Node >=20.12 (CVE-2024-27980), so we run through the shell
  // on Windows instead (args here are simple flags/paths without spaces in this
  // repo, so quoting is not a concern).
  const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, ...(env || {}) },
  });
  return child;
}

function waitForExit(child) {
  return new Promise((resolveExit) => {
    if (!child) return resolveExit(0);
    child.on('exit', (code, signal) => resolveExit(code ?? (signal ? 143 : 1)));
    child.on('error', () => resolveExit(1));
  });
}

async function runAndWait(cmd, args, cwd, env) {
  const child = spawnChild(cmd, args, cwd, env);
  const code = await waitForExit(child);
  if (code !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${code}`);
  }
  return code;
}

async function killTree(pid) {
  if (!pid) return;
  if (isWindows) {
    await new Promise((res) => {
      const k = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
      k.on('exit', () => res());
      k.on('error', () => res());
    });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try { process.kill(pid, 'SIGTERM'); } catch { /* ignore */ }
  }
  await new Promise((r) => setTimeout(r, 1500));
  try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
}

async function killChild(child) {
  if (!child || child.exitCode !== null) return;
  await killTree(child.pid);
  await waitForExit(child);
}

if (process.env.JORVEL_E2E !== '1') {
  // Opt-in by design: prevents accidental long-running e2e during fast dev test loops.
  // CI invokes Playwright via `playwright.config.ts:webServer.env` which always sets
  // JORVEL_E2E=1, so a missing flag in CI means misconfiguration, not silent skip.
  console.warn(
    '[jorvel/e2e] skipped: JORVEL_E2E env var not set to "1". Run with JORVEL_E2E=1 (Playwright already sets this automatically).',
  );
  process.exit(0);
}

const longRunning = [];
let exitCode = 0;

try {
  console.log('=== Build phase: workspace libraries ===');
  // Sequential to keep terminal output sane and avoid race on tsc output dirs in CI.
  await runAndWait('pnpm', ['-C', join(repoRoot, 'packages', 'cli'), 'build'], repoRoot);
  await Promise.all([
    runAndWait('pnpm', ['-C', join(repoRoot, 'libs', 'runtime'), 'build'], repoRoot),
    runAndWait('pnpm', ['-C', join(repoRoot, 'libs', 'event-bus'), 'build'], repoRoot),
    runAndWait('pnpm', ['-C', join(repoRoot, 'libs', 'events'), 'build'], repoRoot),
    runAndWait('pnpm', ['-C', join(repoRoot, 'libs', 'state'), 'build'], repoRoot),
    runAndWait('pnpm', ['-C', join(repoRoot, 'libs', 'types'), 'build'], repoRoot),
  ]);

  console.log('=== Generate federation + routes manifests ===');
  await runAndWait('pnpm', ['-C', exampleDir, 'federation'], repoRoot);
  await runAndWait('node', [cliDist, 'routes', '--dir', exampleDir], repoRoot);

  // Build the proxy federation file the on-demand/proxy scenarios use.
  const { writeFileSync, readFileSync, existsSync } = await import('node:fs');
  const shellDir = join(exampleDir, 'apps', 'shell');
  const basePath = join(shellDir, 'jorvel.federation.json');
  if (existsSync(basePath)) {
    const cfg = JSON.parse(readFileSync(basePath, 'utf8'));
    if (cfg?.remotes?.dashboard) {
      cfg.remotes.dashboard = 'dashboard@http://localhost:3000/jorvel/remotes/dashboard/remoteEntry.js';
    }
    writeFileSync(join(shellDir, 'jorvel.federation.proxy.json'), JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  }
} catch (e) {
  console.error('Build/generate phase failed:', e?.message ?? e);
  process.exit(1);
}

async function waitForUrls(urls) {
  const waitOn = spawnChild(
    'pnpm',
    ['-w', 'exec', '--', 'wait-on', '-t', '60000', ...urls],
    repoRoot,
  );
  const code = await waitForExit(waitOn);
  if (code !== 0) throw new Error(`wait-on exited ${code}`);
}

async function runPlaywright(grep) {
  const args = ['-w', 'exec', '--', 'playwright', 'test'];
  if (grep) args.push('--grep', grep);
  const pw = spawnChild('pnpm', args, repoRoot, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  const code = await waitForExit(pw);
  if (code !== 0) throw new Error(`playwright exited ${code}`);
}

async function runScenario(name, opts) {
  console.log(`\n=== Scenario: ${name} ===`);
  const startRemoteDirectly = opts.mode !== 'on-demand';
  const localChildren = [];

  try {
    if (startRemoteDirectly) {
      localChildren.push(
        spawnChild('pnpm', ['-C', join(exampleDir, 'apps', 'dashboard'), 'dev'], repoRoot),
      );
    }

    const hostEnv = {};
    if (opts.mode === 'proxy') hostEnv.JORVEL_FEDERATION_FILE = 'jorvel.federation.proxy.json';

    if (opts.mode === 'on-demand') {
      localChildren.push(
        spawnChild(
          'node',
          [cliDist, 'dev', '--dir', exampleDir, '--proxy-remotes', '--on-demand'],
          repoRoot,
          hostEnv,
        ),
      );
    } else {
      localChildren.push(
        spawnChild('pnpm', ['-C', join(exampleDir, 'apps', 'shell'), 'dev'], repoRoot, hostEnv),
      );
    }

    longRunning.push(...localChildren);

    const urls = ['http://localhost:3000'];
    if (opts.mode !== 'on-demand') urls.push('http://localhost:3001/remoteEntry.js');
    if (opts.mode !== 'direct')
      urls.push('http://localhost:3000/jorvel/remotes/dashboard/remoteEntry.js');

    console.log('Waiting for dev servers...');
    await waitForUrls(urls);
    console.log('Dev servers are up. Running Playwright...');
    await runPlaywright(opts.grep);
  } finally {
    for (const child of localChildren) await killChild(child);
    // Drop killed children from longRunning.
    for (let i = longRunning.length - 1; i >= 0; i--) {
      if (localChildren.includes(longRunning[i])) longRunning.splice(i, 1);
    }
  }
}

try {
  await runScenario('direct', { mode: 'direct', grep: '@direct' });
  await runScenario('proxy-remotes', { mode: 'proxy', grep: '@proxy' });
  await runScenario('on-demand', { mode: 'on-demand', grep: '@ondemand' });

  console.log('\n=== Scenario: build-output ===');
  await runAndWait(
    'pnpm',
    ['-C', join(exampleDir, 'apps', 'dashboard'), 'build'],
    repoRoot,
    { NODE_ENV: 'production' },
  );
  await runAndWait(
    'pnpm',
    ['-C', join(exampleDir, 'apps', 'shell'), 'build'],
    repoRoot,
    { NODE_ENV: 'production' },
  );
  await runPlaywright('@build');
} catch (err) {
  console.error('Scenario failure:', err?.message ?? err);
  exitCode = exitCode || 1;
} finally {
  for (const child of longRunning) await killChild(child);
}

process.exit(exitCode);
