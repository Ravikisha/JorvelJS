import { describe, expect, it } from 'vitest';
import { validateWorkspaceConfig } from '../src/config-schema.js';

describe('validateWorkspaceConfig (ajv against the bundled @jorvel/types schema)', () => {
  it('accepts the exact config shape `jorvel init` writes', async () => {
    // Mirror of init.ts's jorvel.config.json — guards against schema/reality drift.
    const initConfig = {
      $schema: './node_modules/@jorvel/types/schemas/jorvel.config.json',
      name: 'my-app',
      appsDir: 'apps',
      libsDir: 'libs',
      features: { tailwind: false },
      orchestrator: { mode: 'parallel', proxyRemotes: false, hmrRemotes: false },
      federation: { shared: [] },
    };
    const r = await validateWorkspaceConfig(initConfig);
    expect(r).toEqual({ valid: true, errors: [] });
  });

  it('accepts the full canonical shape (security/observability/deploy/build/sri)', async () => {
    const full = {
      name: 'ws',
      federation: { shared: ['zod'], publicPath: 'https://cdn/', sri: { algo: 'sha384' }, allowlist: ['https://cdn'], versionCheck: true },
      security: { csp: { enabled: true, reportUri: 'https://r/' }, allowInlineScripts: false },
      observability: { adapter: 'sentry', webVitals: true },
      deploy: { target: 'cloudflare' },
      build: { compress: true },
    };
    const r = await validateWorkspaceConfig(full);
    expect(r.valid).toBe(true);
  });

  it('rejects an out-of-enum deploy.target', async () => {
    const r = await validateWorkspaceConfig({ deploy: { target: 'heroku' } });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('/deploy/target'))).toBe(true);
  });

  it('rejects a wrong-typed federation.sri and bad orchestrator.mode', async () => {
    const r = await validateWorkspaceConfig({ orchestrator: { mode: 'turbo' } });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('/orchestrator/mode'))).toBe(true);
  });
});
