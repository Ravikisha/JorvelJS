import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Deployment adapters',
  description:
    'Ship JORVEL SSR to any runtime — Node, Vercel, Cloudflare, Bun, Deno, Netlify, and AWS Lambda / Lambda@Edge — through a single EdgeRequest→EdgeResponse contract.',
};

export default function Adapters() {
  return (
    <>
      <h1>Deployment adapters</h1>
      <p>
        Every adapter converts one <code>createEdgeAdapter</code> handler (
        <code>EdgeRequest → EdgeResponse</code>) into a platform&apos;s native signature. Your SSR
        code stays identical; only the adapter package changes.
      </p>

      <table>
        <thead><tr><th>Package</th><th>Target</th><th>Entry</th></tr></thead>
        <tbody>
          <tr><td><code>@jorvel/adapter-node</code></td><td>Node HTTP server</td><td><code>createNodeHandler</code></td></tr>
          <tr><td><code>@jorvel/adapter-vercel</code></td><td>Vercel Functions</td><td><code>createVercelHandler</code></td></tr>
          <tr><td><code>@jorvel/adapter-cloudflare</code></td><td>Cloudflare Workers</td><td><code>fetch(request, env, ctx)</code></td></tr>
          <tr><td><code>@jorvel/adapter-bun</code></td><td>Bun.serve</td><td><code>createBunHandler</code> / <code>serveBun</code></td></tr>
          <tr><td><code>@jorvel/adapter-deno</code></td><td>Deno Deploy</td><td><code>createDenoHandler</code> / <code>serveDeno</code></td></tr>
          <tr><td><code>@jorvel/adapter-netlify</code></td><td>Netlify Functions/Edge</td><td><code>createNetlifyHandler</code></td></tr>
          <tr><td><code>@jorvel/adapter-aws-lambda</code></td><td>API Gateway v2 + Lambda@Edge</td><td><code>createLambdaHandler</code> / <code>createEdgeLambdaHandler</code></td></tr>
        </tbody>
      </table>

      <h2 id="bun">Bun</h2>
      <CodeBlock
        language="ts"
        code={`import { serveBun } from '@jorvel/adapter-bun';
import { App, template, routes } from './app.js';

serveBun({ App, template, routes, staticDir: 'dist', port: 3000 });
// or: const fetch = createBunHandler({ ... }); Bun.serve({ port: 3000, fetch });`}
      />

      <h2 id="deno">Deno Deploy</h2>
      <CodeBlock
        language="ts"
        code={`import { serveDeno } from '@jorvel/adapter-deno';
import { App, template, routes } from './app.ts';

serveDeno({ App, template, routes }); // Deno.serve under the hood, PORT=8000 default`}
      />

      <h2 id="netlify">Netlify</h2>
      <CodeBlock
        language="ts"
        filename="netlify/edge-functions/ssr.ts"
        code={`import { createNetlifyHandler, netlifyToml } from '@jorvel/adapter-netlify';
import { App, template, routes } from '../../src/app.js';

export default createNetlifyHandler({ App, template, routes });
// \`netlifyToml\` exports a starter netlify.toml routing /* through this function`}
      />

      <h2 id="aws">AWS Lambda &amp; Lambda@Edge</h2>
      <CodeBlock
        language="ts"
        code={`// API Gateway HTTP API (v2)
import { createLambdaHandler } from '@jorvel/adapter-aws-lambda';
export const handler = createLambdaHandler({ App, template, routes });

// CloudFront origin-request (Lambda@Edge)
import { createEdgeLambdaHandler } from '@jorvel/adapter-aws-lambda';
export const handler = createEdgeLambdaHandler({ App, template, routes });`}
      />
      <p>
        The AWS adapter declares its own minimal event/result types, so you don&apos;t need{' '}
        <code>@types/aws-lambda</code> installed. Binary bodies are base64-encoded automatically.
      </p>

      <Callout variant="info" title="Other hosts">
        Fly.io / Render / Railway run the Node adapter in a container — use{' '}
        <code>jorvel deploy --target docker</code> for a Dockerfile and point the platform at it.
      </Callout>

      <Callout variant="warn" title="Streaming on buffered runtimes">
        API Gateway (buffered) can&apos;t stream a <code>ReadableStream</code> body — the AWS adapter
        returns an empty body for streamed responses. Use the Node/Bun/Deno/CF adapters when you
        rely on streaming SSR.
      </Callout>
    </>
  );
}
