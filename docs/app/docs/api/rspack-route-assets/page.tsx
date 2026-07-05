import { CodeBlock } from '@/components/site/code-block';

export const metadata = {
  title: '@jorvel/rspack-route-assets API',
  description: 'Rspack plugin that emits a per-route asset manifest for preloading and SSR head injection.',
};

export default function RouteAssetsApi() {
  return (
    <>
      <h1>@jorvel/rspack-route-assets</h1>
      <p>
        An Rspack plugin that maps each entrypoint/route to the JS + CSS assets it needs, writing a
        manifest you can use for <code>&lt;link rel="preload"&gt;</code> hints and SSR head injection —
        so the right chunks load per route without over-fetching.
      </p>

      <h2 id="plugin">Plugin</h2>
      <CodeBlock
        language="js"
        filename="rspack.config.mjs"
        code={`import { jorvelRspackRouteAssetsPlugin } from '@jorvel/rspack-route-assets';

export default {
  plugins: [
    jorvelRspackRouteAssetsPlugin({
      outputFile: 'route-assets.json',   // manifest path in the output dir
      // ...JorvelRouteAssetsPluginOptions
    }),
  ],
};`}
      />

      <h2 id="api">Exports</h2>
      <CodeBlock
        language="ts"
        code={`jorvelRspackRouteAssetsPlugin(options?: JorvelRouteAssetsPluginOptions): RspackPluginInstance;

// build a RouteAssetsMap from an entrypoints structure (unit-testable, no Rspack needed)
createRouteAssetsFromEntrypoints(entrypoints): RouteAssetsMap;

type RouteAssetsMap = Record<string, { js: string[]; css: string[] }>;`}
      />

      <h2 id="use">Consuming the manifest</h2>
      <p>
        Read the emitted <code>route-assets.json</code> in your SSR handler and inject preloads for
        the matched route via <code>@jorvel/ssr</code>&apos;s head injection (<code>preload.ts</code> helpers).
      </p>
    </>
  );
}
