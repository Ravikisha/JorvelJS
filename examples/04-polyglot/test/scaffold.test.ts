import { describe, it, expect, beforeAll } from 'vitest';
import { access, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const exists = (p: string) => access(p).then(() => true).catch(() => false);
let out = '';

describe("Polyglot example", () => {
  beforeAll(async () => {
    out = await mkdtemp(path.join(os.tmpdir(), 'jorvel-ex-'));
    const r = spawnSync(process.execPath, [path.join(root, 'scaffold.mjs'), out], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('scaffold failed (exit ' + r.status + ')');
  }, 120_000);

  it('scaffolds real framework source (no .mjs app code)', async () => {
    expect(await exists(path.join(out, "apps/pricing/src/Root.vue"))).toBe(true);
    expect(await exists(path.join(out, "apps/reports/src/root.component.ts"))).toBe(true);
    expect(await exists(path.join(out, "apps/widgets/src/Root.tsx"))).toBe(true);
    expect(await exists(path.join(out, "apps/docs-site/src/Root.svelte"))).toBe(true);
    expect(await exists(path.join(out, "apps/dashboard/src/pages/index.tsx"))).toBe(true);
  });
});
