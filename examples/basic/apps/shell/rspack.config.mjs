import { rspack } from '@rspack/core';
import path from 'node:path';
import fs from 'node:fs';

const federationFile = process.env.JORVEL_FEDERATION_FILE || 'jorvel.federation.json';
const federationPath = path.join(process.cwd(), federationFile);
const federation = fs.existsSync(federationPath)
  ? JSON.parse(fs.readFileSync(federationPath, 'utf8'))
  : null;

const sharedWithReactEager = federation?.shared
  ? {
    ...federation.shared,
    react: {
      ...(federation.shared.react || {}),
      eager: true,
      singleton: true,
      strictVersion: true,
      requiredVersion: '^18.3.1',
    },
    'react-dom': {
      ...(federation.shared['react-dom'] || {}),
      eager: true,
      singleton: true,
      strictVersion: true,
      requiredVersion: '^18.3.1',
    },
    '@jorvel/event-bus': {
      ...(federation.shared['@jorvel/event-bus'] || {}),
      eager: true,
      singleton: true,
    },
    '@jorvel/runtime': {
      ...(federation.shared['@jorvel/runtime'] || {}),
      eager: true,
      singleton: true,
    },
    '@jorvel/state': {
      ...(federation.shared['@jorvel/state'] || {}),
      eager: true,
      singleton: true,
    },
  }
  : undefined;

// Proxy rules must be derived from the *original* federation file (jorvel.federation.json),
// not from jorvel.federation.proxy.json (which points back to the host).
const baseFederationPath = path.join(process.cwd(), 'jorvel.federation.json');
const baseFederation = fs.existsSync(baseFederationPath)
  ? JSON.parse(fs.readFileSync(baseFederationPath, 'utf8'))
  : null;

const proxy = baseFederation?.remotes
  ? Object.entries(baseFederation.remotes).map(([remoteName, spec]) => {
      const at = String(spec).indexOf('@');
      const entryUrl = at >= 0 ? String(spec).slice(at + 1) : String(spec);
      const target = entryUrl.replace(/\/remoteEntry\.js$/, '');

      const ctx = `/jorvel/remotes/${remoteName}/remoteEntry.js`;
      return {
        context: [ctx],
        target,
        changeOrigin: true,
        pathRewrite: { [`^${ctx}`]: '/remoteEntry.js' }
      };
    })
  : [];

const isProd = process.env.NODE_ENV === 'production';

export default {
  mode: isProd ? 'production' : 'development',
  entry: {
    main: ['./src/mf-shim.js', './src/main.tsx'],
  },
  // Top-level lazyCompilation:false is required in Rspack ≥1.7 (experiments.lazyCompilation is deprecated).
  // Lazy compilation proxies break eager shared modules (react factory is undefined).
  lazyCompilation: false,
  experiments: {
    css: true,
  },
  devServer: {
    port: 3000,
    static: [
      // Serve /public/* (default) plus also allow fetching flat files like /jorvel.federation.json
      // from the app root during dev.
      { directory: path.join(process.cwd(), 'public') },
      { directory: process.cwd() },
    ],
    historyApiFallback: {
      disableDotRule: true,
      rewrites: [
  // Rspack lazy compilation endpoints (avoid rewriting to index.html).
  { from: /^\/lazy-compilation-using-/, to: (context) => context.parsedUrl.pathname },
  { from: /lazy-compilation-proxy/, to: (context) => context.parsedUrl.pathname },
        // Don't rewrite module/asset requests to index.html.
        {
          from: /^\/(src|@fs)\//,
          to: (context) => context.parsedUrl.pathname,
        },
        {
          from: /\.(mjs|js|cjs|css|json|map|wasm|png|jpe?g|gif|svg|ico|webp|avif|txt|xml)$/,
          to: (context) => context.parsedUrl.pathname,
        },
        // SPA fallback for everything else.
        { from: /./, to: "/index.html" },
      ],
    },
    proxy,
  },
  output: {
    uniqueName: 'shell',
    publicPath: 'auto',
    // Content hashes in production for cache-busting.
    filename: isProd ? '[name].[contenthash:8].js' : '[name].js',
    chunkFilename: isProd ? '[id].[contenthash:8].js' : '[id].js',
  },
  resolve: {
  extensions: ['.tsx', '.ts', '.js'],
  mainFields: ['module', 'browser', 'main']
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic' } }
          }
        }
      }
    ]
  },
  plugins: [
    new rspack.HtmlRspackPlugin({ template: './index.html', scriptLoading: 'module' }),
    ...(federation
      ? [
          new rspack.container.ModuleFederationPlugin({
            name: federation.name,
            filename: federation.filename,
            exposes: federation.exposes,
            remotes: federation.remotes,
            shared: sharedWithReactEager
          })
        ]
      : [])
  ]
};
