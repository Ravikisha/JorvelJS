/**
 * @jorvel/types — Workspace-level configuration (`jorvel.config.ts`).
 *
 * This is intentionally a *small* contract so we can evolve it without
 * breaking early adopters.
 */

export type JorvelFramework = 'react';

export type JorvelRemoteConfig = {
  /** Remote name / container global (for Module Federation). */
  name: string;
  /** Base path mounted by the host, e.g. "/dashboard/*". */
  routes?: string[];
  /** Production URL to `remoteEntry.js` (or a discovery endpoint). */
  remoteEntry?: string;
};

export type JorvelOrchestratorConfig = {
  /** How the CLI should start dev servers. */
  mode?: 'parallel' | 'on-demand';
  /** Enable same-origin remote proxying in dev. */
  proxyRemotes?: boolean;
  /** When a remote recompiles, trigger host reload (best-effort). */
  hmrRemotes?: boolean;
};

export type JorvelFederationConfig = {
  /**
   * Shared packages that should be configured as singletons by default.
   *
   * NOTE: this is *in addition* to the CLI defaults (react/react-dom/runtime/event-bus).
   */
  shared?: string[];
  /** CDN public path baked into every built remote. */
  publicPath?: string;
  /** Subresource Integrity for remoteEntry scripts. */
  sri?: boolean | { algo?: 'sha256' | 'sha384' | 'sha512' };
  /** Remote origin allowlist — the runtime registry rejects unlisted URLs. */
  allowlist?: string[];
  /** Warn when host and remote ship incompatible versions. */
  versionCheck?: boolean;
};

export type JorvelFeaturesConfig = {
  tailwind?: boolean;
  /** Enable the React Compiler (babel-plugin-react-compiler) in generated apps. */
  reactCompiler?: boolean;
  /** Starter template recorded by `jorvel init`. */
  template?: string;
};

export type JorvelSecurityConfig = {
  csp?: {
    enabled?: boolean;
    reportUri?: string;
  };
  allowInlineScripts?: boolean;
};

export type JorvelObservabilityConfig = {
  adapter?: 'console' | 'sentry' | 'none';
  webVitals?: boolean;
};

export type JorvelDeployConfig = {
  target?: 'vercel' | 'cloudflare' | 'netlify' | 'node' | 'docker';
};

export type JorvelBuildConfig = {
  /** Generate .gz/.br assets alongside the build output. */
  compress?: boolean;
};

/**
 * Workspace-level configuration (`jorvel.config.json`, or a `.mjs`/`.js`).
 *
 * This is the SINGLE source of truth for the config shape. It must stay in sync
 * with `@jorvel/types/schemas/jorvel.config.json` (enforced by a test in the CLI
 * that validates against the schema). The CLI's internal config type extends
 * this rather than re-declaring it.
 */
export type JorvelWorkspaceConfig = {
  /** Workspace name. Optional but helpful in tooling output. */
  name?: string;

  /** Folder conventions. */
  appsDir?: string;
  libsDir?: string;

  /** Primary UI framework used in generated templates. */
  framework?: JorvelFramework;

  /** Remote catalog (optional). Can be used by dev/prod orchestration. */
  remotes?: JorvelRemoteConfig[];

  federation?: JorvelFederationConfig;
  orchestrator?: JorvelOrchestratorConfig;
  features?: JorvelFeaturesConfig;
  security?: JorvelSecurityConfig;
  observability?: JorvelObservabilityConfig;
  deploy?: JorvelDeployConfig;
  build?: JorvelBuildConfig;

  /** Plugins (either inline or imported). */
  plugins?: import('./plugins.js').JorvelPlugin[];
};
