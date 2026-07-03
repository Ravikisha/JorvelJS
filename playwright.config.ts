import { defineConfig } from '@playwright/test';

const isCI = !!process.env['CI'];

// `scripts/e2e.mjs` is the orchestrator: it builds, starts the per-scenario dev
// servers, and invokes `playwright test` itself. So the config must NOT declare a
// `webServer` that runs e2e.mjs — that produced an infinite loop (e2e.mjs →
// playwright → webServer → e2e.mjs) and a CI port collision (reuseExistingServer
// is false under CI). The webServer is therefore OFF by default and only enabled
// for an ad-hoc direct `playwright test` via JORVEL_E2E_WEBSERVER=1 (e2e.mjs never
// sets it).
const wantWebServer = process.env['JORVEL_E2E_WEBSERVER'] === '1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  retries: isCI ? 2 : 0,
  forbidOnly: isCI,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ...(isCI ? ([['github'] as ['github']]) : []),
  ],
  use: {
    headless: true,
    trace: isCI ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',
  },
  ...(wantWebServer
    ? {
        webServer: {
          command: 'node ./scripts/e2e.mjs',
          url: 'http://localhost:3000',
          reuseExistingServer: !isCI,
          stdout: 'pipe' as const,
          stderr: 'pipe' as const,
          timeout: 240_000,
          env: { JORVEL_E2E: '1' },
        },
      }
    : {}),
});
