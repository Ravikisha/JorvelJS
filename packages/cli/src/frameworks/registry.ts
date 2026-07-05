/**
 * Framework registry for `jorvel generate remote --framework <fw>`.
 *
 * A JORVEL host is always React (it owns the two-tier router + shell). Remotes
 * can be built with any framework and are embedded through the framework-neutral
 * `@jorvel/mount` contract (see `@jorvel/adapter-*`). This registry holds the
 * per-framework pieces the generic scaffolder assembles into a working remote.
 *
 * React remotes keep their dedicated, battle-tested scaffold path
 * (`scaffoldReactRspackApp`); the specs below cover the non-React frameworks.
 */

export type FrameworkId = 'react' | 'vue' | 'solid' | 'svelte' | 'angular';

/** Source language for a scaffolded app. */
export type AppLang = 'ts' | 'js';

export interface FrameworkSpec {
  id: FrameworkId;
  label: string;
  /** npm package that provides `define<Fn>Remote`. */
  adapter: string;
  /** The adapter's factory export, e.g. `defineVueRemote`. */
  defineFn: string;
  /** Whether this framework only supports TypeScript (Angular). Skips the js/ts prompt. */
  tsOnly?: boolean;
  /** Extensions rspack must resolve, in priority order. */
  resolveExtensions: string[];
  /** Tailwind `content` globs for this framework's template files. */
  tailwindContent: string[];
  /** Runtime deps merged into the app package.json (framework + adapter). */
  deps: Record<string, string>;
  /** Dev deps merged in (loaders/plugins/toolchain). */
  devDeps: Record<string, string>;
  /** Extra top-of-file imports for rspack.config.mjs. */
  rspackImports?: string;
  /** `module.rules[]` entries (JS source, comma-terminated). */
  rspackRules: string;
  /** Extra `plugins[]` entries (JS source, comma-terminated). */
  rspackPlugins?: string;
  /** Extra `rspack.DefinePlugin` keys (JS source, comma-terminated). */
  rspackDefines?: string;
  /** The exposed `./App` entry — `src/remote.<lang>`. */
  remoteEntry: (appName: string, lang: AppLang) => string;
  /** The sample root component file (path relative to app root + contents). */
  rootComponent: (appName: string, lang: AppLang) => { file: string; content: string };
  /** The per-app AI skill describing this framework's remote conventions. */
  skill: (appName: string) => string;
}

/** Published semver for generated apps (see JORVEL_DEP_VERSION in generate.ts). */
const V = '^0.3.0';
const SHARED_DEP = { '@jorvel/mount': V } as const;

// ── Vue 3 ────────────────────────────────────────────────────────────────────
const vue: FrameworkSpec = {
  id: 'vue',
  label: 'Vue 3',
  adapter: '@jorvel/adapter-vue',
  defineFn: 'defineVueRemote',
  resolveExtensions: ['.vue', '.ts', '.js', '.mjs'],
  tailwindContent: ['./index.html', './src/**/*.{vue,ts,js}'],
  deps: { ...SHARED_DEP, '@jorvel/adapter-vue': V, vue: '^3.5.13' },
  devDeps: { 'vue-loader': '^17.4.2' },
  rspackImports: "import { VueLoaderPlugin } from 'vue-loader';",
  rspackRules: `      { test: /\\.vue$/, loader: 'vue-loader' },
      {
        test: /\\.ts$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: { jsc: { parser: { syntax: 'typescript' } } }
      },
      {
        test: /\\.(js|mjs)$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: { jsc: { parser: { syntax: 'ecmascript' } } }
      },`,
  rspackPlugins: '    new VueLoaderPlugin(),',
  rspackDefines: `      '__VUE_OPTIONS_API__': JSON.stringify(true),
      '__VUE_PROD_DEVTOOLS__': JSON.stringify(false),
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': JSON.stringify(false),`,
  remoteEntry: () => `import { defineVueRemote } from '@jorvel/adapter-vue';
import Root from './Root.vue';

// Exposed as './App' — the host embeds this via the JORVEL mount contract.
export default defineVueRemote(Root);
`,
  rootComponent: (name, lang) => ({
    file: 'src/Root.vue',
    content:
      lang === 'ts'
        ? `<script setup lang="ts">
defineProps<{ subpath?: string; basePath?: string; params?: Record<string, string> }>();
</script>

<template>
  <section class="jorvel-remote">
    <h1>${name} <small>(Vue 3 remote)</small></h1>
    <p>Sub-path: <code>{{ subpath }}</code></p>
    <p>This remote is mounted by the host through <code>@jorvel/mount</code>.</p>
  </section>
</template>
`
        : `<script setup>
defineProps({ subpath: String, basePath: String, params: Object });
</script>

<template>
  <section class="jorvel-remote">
    <h1>${name} <small>(Vue 3 remote)</small></h1>
    <p>Sub-path: <code>{{ subpath }}</code></p>
    <p>This remote is mounted by the host through <code>@jorvel/mount</code>.</p>
  </section>
</template>
`,
  }),
  skill: (name) => vueSkill(name),
};

// ── SolidJS ──────────────────────────────────────────────────────────────────
const solid: FrameworkSpec = {
  id: 'solid',
  label: 'SolidJS',
  adapter: '@jorvel/adapter-solid',
  defineFn: 'defineSolidRemote',
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs'],
  tailwindContent: ['./index.html', './src/**/*.{tsx,jsx,ts,js}'],
  deps: { ...SHARED_DEP, '@jorvel/adapter-solid': V, 'solid-js': '^1.9.3' },
  devDeps: {
    'babel-loader': '^9.2.1',
    '@babel/core': '^7.26.0',
    '@babel/preset-typescript': '^7.26.0',
    'babel-preset-solid': '^1.9.3',
  },
  rspackRules: `      {
        test: /\\.[jt]sx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          presets: ['babel-preset-solid', ['@babel/preset-typescript', { onlyRemoveTypeImports: true }]]
        }
      },`,
  remoteEntry: () => `import { defineSolidRemote } from '@jorvel/adapter-solid';
import Root from './Root';

// Exposed as './App' — the host embeds this via the JORVEL mount contract.
export default defineSolidRemote(Root);
`,
  rootComponent: (name, lang) => ({
    file: lang === 'ts' ? 'src/Root.tsx' : 'src/Root.jsx',
    content:
      lang === 'ts'
        ? `import type { SolidRemoteProps } from '@jorvel/adapter-solid';

export default function Root(props: SolidRemoteProps) {
  return (
    <section class="jorvel-remote">
      <h1>${name} <small>(SolidJS remote)</small></h1>
      <p>Sub-path: <code>{props.subpath}</code></p>
      <p>This remote is mounted by the host through <code>@jorvel/mount</code>.</p>
    </section>
  );
}
`
        : `export default function Root(props) {
  return (
    <section class="jorvel-remote">
      <h1>${name} <small>(SolidJS remote)</small></h1>
      <p>Sub-path: <code>{props.subpath}</code></p>
      <p>This remote is mounted by the host through <code>@jorvel/mount</code>.</p>
    </section>
  );
}
`,
  }),
  skill: (name) => solidSkill(name),
};

// ── Svelte 5 ───────────────────────────────────────────────────────────────
const svelte: FrameworkSpec = {
  id: 'svelte',
  label: 'Svelte 5',
  adapter: '@jorvel/adapter-svelte',
  defineFn: 'defineSvelteRemote',
  resolveExtensions: ['.svelte', '.ts', '.js', '.mjs'],
  tailwindContent: ['./index.html', './src/**/*.{svelte,ts,js}'],
  deps: { ...SHARED_DEP, '@jorvel/adapter-svelte': V, svelte: '^5.16.0' },
  devDeps: { 'svelte-loader': '^3.2.4' },
  rspackRules: `      {
        test: /\\.svelte$/,
        exclude: /node_modules/,
        loader: 'svelte-loader',
        options: { compilerOptions: { dev: process.env.NODE_ENV !== 'production' } }
      },
      {
        test: /\\.ts$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: { jsc: { parser: { syntax: 'typescript' } } }
      },
      {
        test: /\\.(js|mjs)$/,
        exclude: /node_modules[\\\\/](?!svelte)/,
        loader: 'builtin:swc-loader',
        options: { jsc: { parser: { syntax: 'ecmascript' } } }
      },
      { test: /node_modules[\\\\/]svelte[\\\\/].*\\.m?js$/, resolve: { fullySpecified: false } },`,
  remoteEntry: () => `import { defineSvelteRemote } from '@jorvel/adapter-svelte';
import Root from './Root.svelte';

// Exposed as './App' — the host embeds this via the JORVEL mount contract.
export default defineSvelteRemote(Root);
`,
  rootComponent: (name, lang) => ({
    file: 'src/Root.svelte',
    content:
      lang === 'ts'
        ? `<script lang="ts">
  let { subpath = '/', basePath = '/', params = {} }:
    { subpath?: string; basePath?: string; params?: Record<string, string> } = $props();
</script>

<section class="jorvel-remote">
  <h1>${name} <small>(Svelte 5 remote)</small></h1>
  <p>Sub-path: <code>{subpath}</code></p>
  <p>This remote is mounted by the host through <code>@jorvel/mount</code>.</p>
</section>
`
        : `<script>
  let { subpath = '/', basePath = '/', params = {} } = $props();
</script>

<section class="jorvel-remote">
  <h1>${name} <small>(Svelte 5 remote)</small></h1>
  <p>Sub-path: <code>{subpath}</code></p>
  <p>This remote is mounted by the host through <code>@jorvel/mount</code>.</p>
</section>
`,
  }),
  skill: (name) => svelteSkill(name),
};

// ── Angular (standalone, JIT) ─────────────────────────────────────────────────
const angular: FrameworkSpec = {
  id: 'angular',
  label: 'Angular',
  adapter: '@jorvel/adapter-angular',
  defineFn: 'defineAngularRemote',
  tsOnly: true,
  resolveExtensions: ['.ts', '.js', '.mjs'],
  tailwindContent: ['./index.html', './src/**/*.{ts,html}'],
  deps: {
    ...SHARED_DEP,
    '@jorvel/adapter-angular': V,
    '@angular/core': '^19.0.0',
    '@angular/common': '^19.0.0',
    '@angular/compiler': '^19.0.0',
    '@angular/platform-browser': '^19.0.0',
    rxjs: '^7.8.1',
    'zone.js': '^0.15.0',
    tslib: '^2.8.1',
  },
  devDeps: {},
  rspackRules: `      {
        test: /\\.ts$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', decorators: true },
            transform: { legacyDecorator: true, decoratorMetadata: true },
            target: 'es2022'
          }
        }
      },`,
  remoteEntry: () => `import 'zone.js';
import { defineAngularRemote } from '@jorvel/adapter-angular';
import { RootComponent } from './root.component';

// Exposed as './App' — the host embeds this via the JORVEL mount contract.
export default defineAngularRemote(RootComponent);
`,
  rootComponent: (name) => ({
    file: 'src/root.component.ts',
    content: `import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'jorvel-${name}-root',
  template: \`
    <section class="jorvel-remote">
      <h1>${name} <small>(Angular remote)</small></h1>
      <p>Sub-path: <code>{{ subpath }}</code></p>
      <p>This remote is mounted by the host through &#64;jorvel/mount.</p>
    </section>
  \`,
})
export class RootComponent {
  @Input() subpath = '/';
  @Input() basePath = '/';
  @Input() params: Record<string, string> = {};
}
`,
  }),
  skill: (name) => angularSkill(name),
};

export const FRAMEWORKS: Record<Exclude<FrameworkId, 'react'>, FrameworkSpec> = {
  vue,
  solid,
  svelte,
  angular,
};

/** All framework choices for the interactive prompt (React first = default). */
export const FRAMEWORK_CHOICES: { value: FrameworkId; name: string }[] = [
  { value: 'react', name: 'React (default)' },
  { value: 'vue', name: 'Vue 3' },
  { value: 'solid', name: 'SolidJS' },
  { value: 'svelte', name: 'Svelte 5' },
  { value: 'angular', name: 'Angular' },
];

export const FRAMEWORK_IDS: FrameworkId[] = ['react', 'vue', 'solid', 'svelte', 'angular'];

export function isFrameworkId(v: string): v is FrameworkId {
  return (FRAMEWORK_IDS as string[]).includes(v);
}

export function getFrameworkSpec(id: FrameworkId): FrameworkSpec | null {
  if (id === 'react') return null;
  return FRAMEWORKS[id];
}

// ── AI skills (per-app) ───────────────────────────────────────────────────────

function skillHeader(name: string, fw: string, slug: string): string {
  return `---
name: ${slug}
description: Build and modify the ${name} ${fw} remote — mount contract, exposed ./App, framework conventions. Trigger when work is scoped to apps/${name}/.
---

# ${name} — ${fw} remote

This app is a **${fw}** micro-frontend, embedded by the React host through the
framework-neutral \`@jorvel/mount\` contract. The host never imports ${fw}.
`;
}

function skillFooter(name: string): string {
  return `
## Boundaries
- \`src/remote.ts\` exposes \`./App\` (the mount module) — this is the federation contract. Don't rename the default export.
- The host mounts into a DOM node it owns and passes \`{ subpath, basePath, params }\`; read routing from those, not from \`window.location\` directly.
- Cross-remote/host communication goes through \`@jorvel/event-bus\` / \`@jorvel/state\` (plain-JS) or DOM \`CustomEvent\`s — never a shared framework context.
- \`rspack.config.mjs\` is generated — regenerate via the CLI, don't hand-edit the federation block.
- After adding pages/routes, keep them internal to this remote (${name} owns \`/${name}/*\`).
`;
}

function vueSkill(name: string): string {
  return `${skillHeader(name, 'Vue 3', 'vue-remote')}
## Conventions
- Root SFC: \`src/Root.vue\` — receives \`subpath\`, \`basePath\`, \`params\` as props.
- Exposed entry: \`src/remote.ts\` → \`export default defineVueRemote(Root)\`.
- Plugins (router, pinia, i18n) go in the \`setup\` option of \`defineVueRemote\`.
- SFCs compile via \`vue-loader\`; \`.ts\` via swc.
${skillFooter(name)}`;
}

function solidSkill(name: string): string {
  return `${skillHeader(name, 'SolidJS', 'solid-remote')}
## Conventions
- Root: \`src/Root.tsx\` — a Solid component taking \`SolidRemoteProps\`.
- Exposed entry: \`src/remote.ts\` → \`export default defineSolidRemote(Root)\`.
- JSX compiles via \`babel-preset-solid\` (babel-loader). Solid reactivity works normally inside the mounted subtree.
${skillFooter(name)}`;
}

function svelteSkill(name: string): string {
  return `${skillHeader(name, 'Svelte 5', 'svelte-remote')}
## Conventions
- Root: \`src/Root.svelte\` — props via \`$props()\` (\`subpath\`, \`basePath\`, \`params\`).
- Exposed entry: \`src/remote.ts\` → \`export default defineSvelteRemote(Root)\`.
- Uses the Svelte 5 \`mount\`/\`unmount\` runtime API; components compile via \`svelte-loader\`.
${skillFooter(name)}`;
}

function angularSkill(name: string): string {
  return `${skillHeader(name, 'Angular', 'angular-remote')}
## Conventions
- Root: \`src/root.component.ts\` — a **standalone** \`@Component\` with \`@Input()\` \`subpath\`/\`basePath\`/\`params\`.
- Exposed entry: \`src/remote.ts\` → \`export default defineAngularRemote(RootComponent)\` (imports \`zone.js\` first).
- App-level providers (HttpClient, router) go in the \`defineAngularRemote(..., { providers })\` option.
- Bootstraps with the standalone API (\`createApplication\` + \`createComponent\`) in JIT mode — no NgModule.
${skillFooter(name)}`;
}
