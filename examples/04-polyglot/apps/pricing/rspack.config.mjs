import { rspack } from '@rspack/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { VueLoaderPlugin } from 'vue-loader';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const federationFile = process.env.JORVEL_FEDERATION_FILE || 'jorvel.federation.json';
const federationPath = path.join(__dirname, federationFile);
const federation = fs.existsSync(federationPath)
  ? JSON.parse(fs.readFileSync(federationPath, 'utf8'))
  : null;

export default {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  entry: { main: ['./src/mf-shim.js', './src/main.ts'] },
  lazyCompilation: false,
  experiments: { css: true },
  devServer: {
    port: 3002,
    hot: false,
    liveReload: true,
    historyApiFallback: true,
    static: [{ directory: __dirname }],
  },
  output: {
    uniqueName: "pricing",
    publicPath: 'auto',
    filename: process.env.NODE_ENV === 'production' ? '[name].[contenthash:8].js' : '[name].js',
    chunkFilename: process.env.NODE_ENV === 'production' ? '[id].[contenthash:8].js' : '[id].js',
  },
  resolve: {
    extensions: [".vue",".ts",".js",".mjs"],
  },
  module: {
    rules: [
      { test: /\.css$/, use: ['postcss-loader'], type: 'css/auto' },
      { test: /\.vue$/, loader: 'vue-loader' },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: { jsc: { parser: { syntax: 'typescript' } } }
      },
      {
        test: /\.(js|mjs)$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: { jsc: { parser: { syntax: 'ecmascript' } } }
      },
    ]
  },
  plugins: [
    new rspack.DefinePlugin({
      'import.meta.env.JORVEL_FEDERATION_FILE': JSON.stringify(process.env.JORVEL_FEDERATION_FILE || ''),
      '__VUE_OPTIONS_API__': JSON.stringify(true),
      '__VUE_PROD_DEVTOOLS__': JSON.stringify(false),
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': JSON.stringify(false),
    }),
    new rspack.HtmlRspackPlugin({ template: './index.html', scriptLoading: 'module' }),
    new VueLoaderPlugin(),
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
