import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { scaffoldStorybook } from '../src/commands/generate-storybook.js';

async function workspace(ts = true): Promise<string> {
  const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-sb-'))) as string;
  const shell = path.join(tmp, 'apps', 'shell');
  await fs.ensureDir(shell);
  await fs.writeJson(path.join(shell, 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
  await fs.writeJson(path.join(shell, 'package.json'), { name: '@app/shell', devDependencies: {} });
  if (ts) await fs.writeJson(path.join(shell, 'tsconfig.json'), {});
  return tmp;
}

describe('scaffoldStorybook', () => {
  it('writes storybook config, a component + story, and scripts (TS)', async () => {
    const tmp = await workspace();
    await scaffoldStorybook({ dir: tmp, log: () => {} });
    const shell = path.join(tmp, 'apps', 'shell');
    expect(await fs.pathExists(path.join(shell, '.storybook', 'main.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(shell, '.storybook', 'preview.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(shell, 'src', 'components', 'Button.stories.tsx'))).toBe(true);
    const pkg = await fs.readJson(path.join(shell, 'package.json'));
    expect(pkg.scripts.storybook).toContain('storybook dev');
    expect(pkg.devDependencies['storybook']).toBeDefined();
  });

  it('emits .jsx/.js for a JS app', async () => {
    const tmp = await workspace(false);
    await scaffoldStorybook({ dir: tmp, log: () => {} });
    const shell = path.join(tmp, 'apps', 'shell');
    expect(await fs.pathExists(path.join(shell, '.storybook', 'main.js'))).toBe(true);
    expect(await fs.pathExists(path.join(shell, 'src', 'components', 'Button.stories.jsx'))).toBe(true);
  });
});
