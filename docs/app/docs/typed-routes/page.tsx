import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Typed routes',
  description:
    'Bind paths to validators (Zod, Valibot, Yup, custom). Compile-time types + runtime validation for params and search.',
};

export default function TypedRoutes() {
  return (
    <>
      <h1>Typed routes</h1>
      <p>
        <code>createRoute</code> binds a path to a validator (Zod, Valibot, Yup, anything with a{' '}
        <code>parse</code> method). You get compile-time types + runtime validation for params and
        search, plus a typed <code>build()</code> helper so you can never construct a broken URL.
      </p>
      <Callout variant="success" title="Why bother?">
        Untyped <code>useParams()</code> returns <code>Record&lt;string, string&gt;</code>. By the
        time a typo lands in production it has already cost a refund. <code>createRoute</code>{' '}
        turns &quot;page broken because <code>userid</code> ≠ <code>userId</code>&quot; into a red
        squiggle in the IDE, and a 404 instead of a render crash at runtime.
      </Callout>

      <h2 id="zod">Zod example</h2>
      <CodeBlock
        language="ts"
        code={`import { z } from 'zod';
import { createRoute, defineRoutes } from '@jorvel/runtime';

const userRoute = createRoute({
  path: '/users/:id',
  params: z.object({ id: z.string().uuid() }),
  search: z.object({ tab: z.enum(['profile', 'billing']).default('profile') }),
});

export const routes = defineRoutes({ user: userRoute });

// match
const m = userRoute.match('/users/abc-def');
if (m) m.params.id; // typed string (uuid validated)

// build
const url = userRoute.build({ id: 'abc' }, { tab: 'billing' });
// -> '/users/abc?tab=billing'`}
      />

      <h2 id="no-validator">No validator — raw params</h2>
      <p>
        Omit <code>params</code> to get <code>Record&lt;string, string&gt;</code>. Useful for
        prototyping or for paths where the param type is intrinsically a string (slug, opaque ID).
      </p>
      <CodeBlock
        language="ts"
        code={`const r = createRoute({ path: '/orders/:orderId' });
r.match('/orders/42')?.params.orderId;  // string`}
      />

      <h2 id="define-routes">defineRoutes — route registry</h2>
      <p>
        Group routes into one object and reference them by key. Build URLs without sprinkling
        string literals across the codebase — the moment you rename a route or change a param
        name, TypeScript catches every call site.
      </p>
      <CodeBlock
        language="ts"
        code={`import { defineRoutes, createRoute } from '@jorvel/runtime';
import { z } from 'zod';

export const routes = defineRoutes({
  home:    createRoute({ path: '/' }),
  user:    createRoute({
    path: '/users/:id',
    params: z.object({ id: z.string().uuid() }),
    search: z.object({ tab: z.enum(['profile', 'billing']).default('profile') }),
  }),
  invoice: createRoute({
    path: '/billing/invoices/:invoiceId',
    params: z.object({ invoiceId: z.string().regex(/^inv_\\w+$/) }),
  }),
});

// Use anywhere
const url = routes.user.build({ id: crypto.randomUUID() }, { tab: 'billing' });
dispatchJorvelNavigate({ to: url });`}
      />

      <h2 id="read-params">Read params inside a page</h2>
      <p>
        Inside the route&apos;s component, pull the typed params from the standard{' '}
        <code>useParams</code> hook. The Zod schema becomes the source of truth for the type.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { useParams } from '@jorvel/runtime';
import type { z } from 'zod';
import { routes } from '@/routes';

type UserParams = z.infer<typeof routes.user['_paramsSchema']>;

export default function UserPage() {
  const { id } = useParams<UserParams>();   // 'string' (uuid validated upstream)
  return <h1>User {id}</h1>;
}`}
      />

      <h2 id="validators">Supported validators</h2>
      <p>
        Any object with a <code>parse(input) =&gt; T</code> method works. The optional{' '}
        <code>safeParse(input)</code> hook (returns <code>{`{ success: true, data }`}</code> or{' '}
        <code>{`{ success: false, error }`}</code>) is used when available for non-throwing match
        attempts.
      </p>
      <table>
        <thead><tr><th>Library</th><th>Works out of the box</th></tr></thead>
        <tbody>
          <tr><td><a href="https://zod.dev" target="_blank" rel="noopener noreferrer">Zod</a></td><td>Yes — <code>z.object(...)</code></td></tr>
          <tr><td><a href="https://valibot.dev" target="_blank" rel="noopener noreferrer">Valibot</a></td><td>Yes — <code>v.object(...)</code></td></tr>
          <tr><td><a href="https://yup.com" target="_blank" rel="noopener noreferrer">Yup</a></td><td>Yes — <code>yup.object(...)</code></td></tr>
          <tr><td><a href="https://arktype.io" target="_blank" rel="noopener noreferrer">Arktype</a></td><td>Yes — same <code>parse</code> shape</td></tr>
          <tr><td>Plain function</td><td>Wrap in <code>{`{ parse(x) { return ... } }`}</code></td></tr>
        </tbody>
      </table>

      <h2 id="failure-modes">Validation failure modes</h2>
      <table>
        <thead>
          <tr><th>Call</th><th>On invalid input</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>route.match(pathname)</code></td>
            <td>Returns <code>null</code> — caller falls through to the next route.</td>
          </tr>
          <tr>
            <td><code>route.parse(input)</code></td>
            <td>Throws the validator&apos;s error (Zod error, Yup error, etc).</td>
          </tr>
          <tr>
            <td><code>route.safeParse(input)</code></td>
            <td><code>{`{ success: true, data }`}</code> or <code>{`{ success: false, error }`}</code>.</td>
          </tr>
        </tbody>
      </table>

      <h2 id="custom">Custom validator</h2>
      <p>
        Any object with a <code>parse(input): T</code> method works — implement{' '}
        <code>safeParse</code> for non-throwing validation if you call <code>match</code> often.
      </p>
      <CodeBlock
        language="ts"
        code={`const validator = {
  parse: (x: unknown) => {
    if (!x || typeof (x as any).id !== 'string') throw new Error('bad params');
    return x as { id: string };
  },
};
createRoute({ path: '/x/:id', params: validator });`}
      />

      <h2 id="search-defaults">Search-param defaults</h2>
      <p>
        Use the validator&apos;s default mechanism (<code>z.default()</code>,{' '}
        <code>v.optional(..., 'default')</code>) so missing keys come back populated. The default
        is also written into <code>build()</code> output — if the value matches the default,{' '}
        <code>build</code> omits it from the URL for cleanliness.
      </p>
      <CodeBlock
        language="ts"
        code={`const list = createRoute({
  path: '/items',
  search: z.object({
    page: z.coerce.number().default(1),
    sort: z.enum(['asc', 'desc']).default('asc'),
  }),
});

list.build({}, { page: 1, sort: 'asc' });    // '/items'        (defaults dropped)
list.build({}, { page: 2 });                  // '/items?page=2'`}
      />

      <h2 id="splats">Splat segments</h2>
      <p>
        Trailing splats are typed as a <code>string[]</code> (or <code>string</code> joined by{' '}
        <code>/</code> — pick via <code>splat: 'joined'</code>):
      </p>
      <CodeBlock
        language="ts"
        code={`const docs = createRoute({
  path: '/docs/*',
  params: z.object({ wildcard: z.array(z.string()) }),
});

docs.match('/docs/api/runtime/hooks')?.params.wildcard;
// ['api', 'runtime', 'hooks']

// build() encodes each segment but keeps the '/' separators — no %2F
docs.build({ wildcard: ['api', 'runtime', 'hooks'] });
// '/docs/api/runtime/hooks'`}
      />

      <h2 id="ssr">SSR usage</h2>
      <p>
        On the server, call <code>route.match(url.pathname)</code> directly — no React, no hooks.
        The result feeds <code>renderRouteToString</code>:
      </p>
      <CodeBlock
        language="ts"
        code={`const m = routes.user.match(new URL(request.url).pathname);
if (!m) return new Response('Not Found', { status: 404 });
// m.params.id is type-narrowed`}
      />

      <Callout variant="info" title="Co-locate the registry">
        Put <code>defineRoutes(...)</code> in a top-level file (<code>src/routes.ts</code>) and
        import it from anywhere — host, remote, SSR handler. Same source of truth, same types.
      </Callout>
    </>
  );
}
