import { CodeBlock } from '@/components/site/code-block';

export const metadata = {
  title: 'Adapter APIs',
  description: 'Entry points for every deployment adapter — Node, Vercel, Cloudflare, Bun, Deno, Netlify, AWS.',
};

export default function AdapterApi() {
  return (
    <>
      <h1>Adapter APIs</h1>
      <p>
        Every adapter wraps a <code>createEdgeAdapter({'{ App, template, routes }'})</code> handler.
        See <a href="/docs/adapters">Deployment adapters</a> for the guide.
      </p>
      <CodeBlock
        language="ts"
        code={`// @jorvel/adapter-node
createNodeHandler(opts): (req, res) => void;

// @jorvel/adapter-vercel
createVercelHandler(opts): (req: Request) => Promise<Response>;

// @jorvel/adapter-cloudflare
createCloudflareHandler(opts): { fetch(request, env, ctx): Promise<Response> };  // onRequest(env) hook

// @jorvel/adapter-bun
createBunHandler(opts): (req: Request) => Promise<Response>;   serveBun(opts): { port; stop() };

// @jorvel/adapter-deno
createDenoHandler(opts): (req: Request) => Promise<Response>;  serveDeno(opts);

// @jorvel/adapter-netlify
createNetlifyHandler(opts): (req: Request) => Promise<Response>;   netlifyToml: string;

// @jorvel/adapter-aws-lambda
createLambdaHandler(opts): (event: ApiGatewayProxyEventV2) => Promise<ApiGatewayProxyResultV2>;
createEdgeLambdaHandler(opts): (event: CloudFrontEvent) => Promise<CloudFrontResponse>;`}
      />
    </>
  );
}
