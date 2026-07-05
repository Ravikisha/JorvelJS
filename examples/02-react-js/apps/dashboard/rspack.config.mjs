import { rspack } from '@rspack/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import ReactRefreshPlugin from '@rspack/plugin-react-refresh';

// Resolve relative to this config file so federation config is found regardless
// of where the dev server was invoked from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const federationFile = process.env.JORVEL_FEDERATION_FILE || 'jorvel.federation.json';
const federationPath = path.join(__dirname, federationFile);
const federation = fs.existsSync(federationPath)
  ? JSON.parse(fs.readFileSync(federationPath, 'utf8'))
  : null;

const onDemandStarterUrl = process.env.JORVEL_ON_DEMAND_STARTER_URL || '';
const onDemandMiddleware = process.env.JORVEL_ON_DEMAND_MIDDLEWARE === '1';

const proxy = federation?.remotes
  ? Object.entries(federation.remotes).map(([remoteName, spec]) => {
      const at = String(spec).indexOf('@');
      const entryUrl = at >= 0 ? String(spec).slice(at + 1) : String(spec);
      // Compute the origin (origin + path-without-trailing-filename).
      let target;
      try {
        const u = new URL(entryUrl);
        target = u.origin;
      } catch {
        target = entryUrl.replace(/\/[^/]+$/, '');
      }
      const ctxBase = '/jorvel/remotes/' + remoteName;
      return {
        context: [ctxBase],
        target,
        onProxyReq: () => {
          if (!onDemandMiddleware) return;
          if (!onDemandStarterUrl) return;
          try {
            http
              .get(
                onDemandStarterUrl + '/__jorvel/start-remote?name=' + encodeURIComponent(remoteName)
              )
              .on('error', () => {});
          } catch { /* ignore */ }
        },
        changeOrigin: true,
        pathRewrite: { ['^' + ctxBase]: '' }
      };
    })
  : [];

export default {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  entry: {
    main: ['./src/mf-shim.js', './src/main.jsx'],
  },
  // Rspack >=1.7: lazyCompilation is a top-level option; experiments.lazyCompilation
  // is deprecated. Lazy compilation proxies break eager shared modules (the react
  // factory comes back undefined), so it's disabled.
  lazyCompilation: false,
  experiments: {
    css: true,
  },
  devServer: {
    port: 3001,
    hot: true,
    liveReload: false,
    static: [
      { directory: path.join(__dirname, 'public') },
      { directory: __dirname },
    ],
    historyApiFallback: {
      disableDotRule: true,
      rewrites: [
        {
          from: /^\/(src|@fs)\//,
          to: (context) => context.parsedUrl.pathname,
        },
        {
          from: /\.(mjs|js|cjs|css|json|map|wasm|png|jpe?g|gif|svg|ico|webp|avif|txt|xml)$/,
          to: (context) => context.parsedUrl.pathname,
        },
        { from: /./, to: '/index.html' },
      ],
    },
    proxy,
  },
  output: {
    uniqueName: "dashboard",
    publicPath: 'auto',
    filename: process.env.NODE_ENV === 'production' ? '[name].[contenthash:8].js' : '[name].js',
    chunkFilename: process.env.NODE_ENV === 'production' ? '[id].[contenthash:8].js' : '[id].js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'],
    extensionAlias: {
      '.js': ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'],
    },
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
            transform: { react: { runtime: 'automatic', development: process.env.NODE_ENV !== 'production', refresh: process.env.NODE_ENV !== 'production' } }
          }
        }
      },
      {
        test: /\.(js|jsx|mjs|cjs)$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'ecmascript', jsx: true },
            transform: { react: { runtime: 'automatic', development: process.env.NODE_ENV !== 'production', refresh: process.env.NODE_ENV !== 'production' } }
          }
        }
      }
    ]
  },
  plugins: [
    // Rspack 1.x removed builtins.define — use the DefinePlugin. These keys are
    // matched as exact member expressions, so client code must read them as
    // `import.meta.env.JORVEL_*` (no optional chaining, which produces an AST
    // the plugin won't match).
    new rspack.DefinePlugin({
      'import.meta.env.JORVEL_FEDERATION_FILE': JSON.stringify(process.env.JORVEL_FEDERATION_FILE || ''),
      'import.meta.env.JORVEL_DEV_RELOAD_URL': JSON.stringify(process.env.JORVEL_DEV_RELOAD_URL || ''),
      'import.meta.env.JORVEL_ON_DEMAND_STARTER_URL': JSON.stringify(process.env.JORVEL_ON_DEMAND_STARTER_URL || ''),
    }),
    new rspack.HtmlRspackPlugin({ template: './index.html', scriptLoading: 'module' }),
    ...(process.env.NODE_ENV !== 'production' ? [new ReactRefreshPlugin()] : []),
    ...(federation
      ? [
          new rspack.container.ModuleFederationPlugin({
            name: federation.name,
            filename: federation.filename,
            exposes: federation.exposes,
            remotes: federation.remotes,
            shared: federation.shared
          })
        ]
      : [])
  ]
};
