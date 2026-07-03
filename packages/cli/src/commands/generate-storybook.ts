/**
 * `jorvel generate storybook [app]` — scaffold Storybook 8 (Rspack builder) into
 * an app: `.storybook/{main,preview}.ts`, a sample story, and package scripts.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { discoverApps } from '../discovery.js';
import { JorvelCliError } from '../errors.js';

export interface ScaffoldStorybookOptions {
  dir: string;
  app?: string;
  log?: (msg: string) => void;
}

async function resolveApp(workspaceDir: string, appName?: string): Promise<{ dir: string; name: string; isTs: boolean }> {
  const apps = await discoverApps(workspaceDir);
  if (apps.length === 0) {
    throw new JorvelCliError('No apps found under apps/*.', { code: 'SB-001', hint: 'jorvel generate host shell' });
  }
  const picked = appName
    ? apps.find((a) => a.meta.name === appName)
    : (apps.find((a) => a.meta.type === 'host') ?? apps[0]);
  if (appName && !picked) {
    throw new JorvelCliError(`App "${appName}" not found.`, { code: 'SB-002', hint: `Available: ${apps.map((a) => a.meta.name).join(', ')}` });
  }
  const app = picked ?? apps[0]!;
  const isTs = await fs.pathExists(path.join(app.dir, 'tsconfig.json'));
  return { dir: app.dir, name: app.meta.name, isTs };
}

/** Scaffold Storybook files into the target app. Returns written relative paths. */
export async function scaffoldStorybook(opts: ScaffoldStorybookOptions): Promise<string[]> {
  const workspaceDir = path.resolve(opts.dir);
  const log = opts.log ?? ((m: string) => console.log(m));
  const app = await resolveApp(workspaceDir, opts.app);
  const ext = app.isTs ? 'ts' : 'js';
  const cext = app.isTs ? 'tsx' : 'jsx';
  const written: string[] = [];
  const write = async (rel: string, content: string) => {
    const abs = path.join(app.dir, rel);
    await fs.outputFile(abs, content, 'utf8');
    written.push(path.relative(workspaceDir, abs));
  };

  await write(`.storybook/main.${ext}`, [
    `import type { StorybookConfig } from 'storybook-react-rsbuild';`,
    '',
    'const config: StorybookConfig = {',
    `  stories: ['../src/**/*.stories.@(${cext}|mdx)'],`,
    `  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],`,
    `  framework: { name: 'storybook-react-rsbuild', options: {} },`,
    '};',
    'export default config;',
    '',
  ].join('\n'));

  await write(`.storybook/preview.${ext}`, [
    app.isTs ? `import type { Preview } from '@storybook/react';` : '',
    '',
    app.isTs ? 'const preview: Preview = {' : 'const preview = {',
    '  parameters: {',
    '    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },',
    '  },',
    '};',
    'export default preview;',
    '',
  ].filter(Boolean).join('\n'));

  await write(`src/components/Button.${cext}`, [
    `import React from 'react';`,
    '',
    app.isTs
      ? `export function Button({ label, onClick }: { label: string; onClick?: () => void }) {`
      : `export function Button({ label, onClick }) {`,
    '  return <button onClick={onClick} style={{ padding: \'6px 12px\', borderRadius: 6 }}>{label}</button>;',
    '}',
    '',
  ].join('\n'));

  await write(`src/components/Button.stories.${cext}`, [
    app.isTs ? `import type { Meta, StoryObj } from '@storybook/react';` : '',
    `import { Button } from './Button.js';`,
    '',
    app.isTs ? `const meta: Meta<typeof Button> = { title: 'Button', component: Button };` : `const meta = { title: 'Button', component: Button };`,
    'export default meta;',
    '',
    app.isTs ? `type Story = StoryObj<typeof Button>;` : '',
    app.isTs ? `export const Primary: Story = { args: { label: 'Click me' } };` : `export const Primary = { args: { label: 'Click me' } };`,
    '',
  ].filter(Boolean).join('\n'));

  const pkgPath = path.join(app.dir, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    pkg.scripts = { ...(pkg.scripts ?? {}), storybook: 'storybook dev -p 6006', 'build-storybook': 'storybook build' };
    pkg.devDependencies = {
      ...(pkg.devDependencies ?? {}),
      storybook: '^8.4.7',
      '@storybook/react': '^8.4.7',
      'storybook-react-rsbuild': '^0.2.0',
      '@storybook/addon-essentials': '^8.4.7',
      '@storybook/addon-a11y': '^8.4.7',
    };
    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
    written.push(path.relative(workspaceDir, pkgPath));
  }

  log(kleur.green(`Scaffolded Storybook into "${app.name}":`));
  for (const f of written) log(kleur.gray(`  - ${f}`));
  log(kleur.gray('Next: install deps, then `pnpm --filter ./apps/' + app.name + ' storybook`.'));
  return written;
}

export function attachStorybook(parent: Command): void {
  parent
    .command('storybook')
    .description('Scaffold Storybook (Rsbuild builder) into an app')
    .argument('[app]', 'Target app (default: host)')
    .option('-d, --dir <path>', 'Workspace root', process.cwd())
    .action(async (app: string | undefined, o: { dir: string }) => {
      await scaffoldStorybook({ dir: o.dir, ...(app ? { app } : {}) });
    });
}
