import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@jorvel/runtime API',
  description:
    'Full surface area of @jorvel/runtime — router, remote loader, hooks, guards, telemetry, View Transitions, islands, Service Worker, Shadow DOM.',
};

export default function RuntimeApi() {
  return (
    <>
      <h1>@jorvel/runtime</h1>
      <p>
        Singleton-safe router, remote loader, hooks, guards, telemetry. Every export below is
        importable from <code>@jorvel/runtime</code>; the package is configured as a Module
        Federation singleton so host and remote observe the same router instance.
      </p>

      <Callout variant="info" title="Type-safety">
        Every function below is fully typed. Pass generics where shown to thread types from your
        own route registry through to hooks.
      </Callout>

      <h2 id="router">Router</h2>
      <table>
        <thead><tr><th>Symbol</th><th>Signature</th></tr></thead>
        <tbody>
          <tr><td><code>getRouter</code></td><td><code>(opts?: RouterOptions) =&gt; Router</code> — returns the singleton, creating it on first call</td></tr>
          <tr><td><code>createRouter</code></td><td><code>(opts?: RouterOptions) =&gt; Router</code> — fresh instance, for tests</td></tr>
          <tr><td><code>useRouter</code></td><td><code>() =&gt; Router</code> — hook</td></tr>
          <tr><td><code>usePathname</code></td><td><code>() =&gt; string</code> — pathname + search + hash</td></tr>
          <tr><td><code>dispatchJorvelNavigate</code></td><td><code>(detail: NavigateDetail) =&gt; void</code></td></tr>
          <tr><td><code>attachJorvelNavigateListener</code></td><td><code>() =&gt; () =&gt; void</code> — returns disposer</td></tr>
        </tbody>
      </table>
      <CodeBlock
        language="ts"
        code={`type NavigateDetail = {
  to: string;                     // pathname + optional ?search and #hash
  mode?: 'push' | 'replace';      // default 'push'
  state?: unknown;                // stored via history.{push,replace}State
};

type RouterOptions = {
  basePath?: string;              // ignore paths outside this prefix
  listenToNavigateEvents?: boolean; // default true
};`}
      />

      <h2 id="components">Routing components</h2>
      <table>
        <thead><tr><th>Component</th><th>Props</th></tr></thead>
        <tbody>
          <tr><td><code>&lt;NavLink&gt;</code></td><td><code>to</code>, <code>label</code>, <code>prefetch?</code>, <code>activeStyle?</code>, <code>className?</code>, <code>activeClassName?</code></td></tr>
          <tr><td><code>&lt;NavLinkPrefetchProvider&gt;</code></td><td><code>config: {'{ routes, remotes }'}</code></td></tr>
          <tr><td><code>&lt;RemoteOutlet&gt;</code></td><td><code>routes</code>, <code>remotes</code>, <code>fallback?</code>, <code>noMatch?</code>, <code>errorBoundary?</code></td></tr>
          <tr><td><code>&lt;RemoteApp&gt;</code></td><td><code>subpath</code>, <code>pages</code>, <code>fallback?</code>, <code>noMatch?</code></td></tr>
          <tr><td><code>&lt;ErrorBoundary&gt;</code></td><td><code>fallback: (err, reset) =&gt; ReactNode</code>, <code>onError?: (err) =&gt; void</code></td></tr>
        </tbody>
      </table>

      <h2 id="nested">Nested routes</h2>
      <ul>
        <li><code>&lt;NestedRouter routes fallback? notFound? /&gt;</code></li>
        <li><code>&lt;Outlet /&gt;</code> — child slot</li>
        <li><code>useOutletParams&lt;T&gt;(): T</code></li>
        <li><code>resolveChain(routes, pathname): NestedMatch[]</code> — pure resolver, no React</li>
        <li>
          Per-segment boundaries: <code>NestedRoute.loading</code> (<code>loading.tsx</code>{' '}
          Suspense fallback) and <code>NestedRoute.errorElement</code> (<code>error.tsx</code> —{' '}
          node or <code>{'(p: { error, reset }) => ReactNode'}</code>)
        </li>
      </ul>

      <h2 id="middleware">Middleware</h2>
      <CodeBlock
        language="ts"
        code={`type MiddlewareDecision =
  | { type: 'next'; headers?: Record<string, string> }
  | { type: 'redirect'; to: string; status: 301|302|303|307|308 }
  | { type: 'rewrite'; to: string }
  | { type: 'respond'; response: Response };

type Middleware = (ctx: {
  pathname: string;
  searchParams: URLSearchParams;
  url?: URL;
  request?: Request;
  state: Record<string, unknown>;
}) => MiddlewareDecision | void | Promise<MiddlewareDecision | void>;

defineMiddleware(fn: Middleware): Middleware;
next(headers?): MiddlewareDecision;
redirect(to, status = 307): MiddlewareDecision;
rewrite(to): MiddlewareDecision;
respond(response): MiddlewareDecision;

// matcher: '*' = one segment, '**' = any depth; first terminal decision wins
runMiddleware(
  chain: Array<Middleware | { matcher?: string | string[]; handler: Middleware }>,
  init: { pathname: string; searchParams?; url?; request?; state? },
): Promise<MiddlewareDecision>;`}
      />

      <h2 id="actions">Server actions (mutations)</h2>
      <CodeBlock
        language="ts"
        code={`// reads use defineLoader / useLoaderData from @jorvel/ssr; actions are the write side
defineAction<I, O>(fn: (input: I, ctx?: { request?; signal? }) => O | Promise<O>): Action<I, O>;

// pending/error/data state machine; concurrent submits are last-wins
useAction<I, O>(action): { data: O | null; error: unknown; pending: boolean; submit(i: I): Promise<O>; reset(): void };

// binds a FormData action to <form onSubmit>; progressive-enhancement friendly
useFormAction<O>(action): { onSubmit(e); submit(fd: FormData): Promise<O>; data; error; pending; reset };`}
      />

      <h2 id="typed">Typed routes</h2>
      <CodeBlock
        language="ts"
        code={`type Validator<T> = { parse(input: unknown): T; safeParse?(input: unknown): { success: true; data: T } | { success: false; error: unknown } };

createRoute<TParams, TSearch>({
  path: string;                   // '/users/:id'
  params?: Validator<TParams>;
  search?: Validator<TSearch>;
}): TypedRoute<TParams, TSearch>;

defineRoutes<T extends Record<string, TypedRoute<any, any>>>(map: T): T;`}
      />

      <h2 id="hooks">Hooks</h2>
      <table>
        <thead><tr><th>Hook</th><th>Signature</th></tr></thead>
        <tbody>
          <tr><td><code>useSearchParams</code></td><td><code>() =&gt; [URLSearchParams, (next, mode?: &apos;push&apos; | &apos;replace&apos;) =&gt; void]</code></td></tr>
          <tr><td><code>useQueryParam</code></td><td><code>(key: string) =&gt; [string | null, (next: string | null) =&gt; void]</code></td></tr>
          <tr><td><code>useParams</code></td><td><code>&lt;T&gt;() =&gt; T</code> — from the nearest <code>ParamsProvider</code></td></tr>
          <tr><td><code>useNavigate</code></td><td><code>() =&gt; (to: string, opts?: {'{ replace?, state? }'}) =&gt; void</code></td></tr>
          <tr><td><code>useNavigationEvents</code></td><td><code>(handler: (e: NavigationEvent) =&gt; void) =&gt; void</code></td></tr>
          <tr><td><code>useRemoteData</code></td><td><code>{'<T>({ key, fetcher, ttl? }) => { data, error, loading, refresh }'}</code></td></tr>
        </tbody>
      </table>

      <h2 id="guards">Guards</h2>
      <CodeBlock
        language="ts"
        code={`type GuardResult = boolean | { redirect: string };
type RouteGuard = (ctx: { pathname: string; params: Record<string, string> }) => GuardResult | Promise<GuardResult>;

runGuards(resolved, pathname, globalGuards?: RouteGuard[]): Promise<GuardResult>;

createAuthGuard({
  isAuthenticated: () => boolean | Promise<boolean>;
  loginPath?: string;             // default '/login'
  captureReturnTo?: boolean;      // default true — appends ?next=…
}): RouteGuard;

createRoleGuard({
  hasRole: (role: string) => boolean;
  roles: string[];                // any-of
  fallbackPath?: string;
}): RouteGuard;`}
      />

      <h2 id="view-transitions">View Transitions</h2>
      <ul>
        <li><code>navigateWithTransition(detail, opts?: {'{ respectReducedMotion? }'})</code></li>
        <li><code>withViewTransition(update: () =&gt; void | Promise&lt;void&gt;, opts?)</code></li>
        <li><code>supportsViewTransitions(): boolean</code></li>
        <li><code>prefersReducedMotion(): boolean</code></li>
      </ul>

      <h2 id="prefetch">Prefetch</h2>
      <ul>
        <li><code>prefetchRoute(pathname: string, config: {'{ routes, remotes }'}): Promise&lt;void&gt;</code></li>
        <li><code>resetPrefetchCache(): void</code></li>
      </ul>

      <h2 id="preload">Concurrent preload</h2>
      <CodeBlock
        language="ts"
        code={`preloadRemotes(
  remotes: Array<{ name: string; entryUrl: string; integrity?: string }>,
  opts?: {
    concurrency?: number;   // default 3
    idle?: boolean;         // default true — wraps each load in requestIdleCallback
    idleBudgetMs?: number;  // default 8
    onResult?: (r: { remote: string; ok: boolean; durationMs: number; error?: unknown }) => void;
  },
): Promise<void>;`}
      />

      <h2 id="sw">Service Worker</h2>
      <CodeBlock
        language="ts"
        code={`registerJorvelServiceWorker(opts?: {
  url?: string;                   // default '/jorvel-sw.js'
  scope?: string;                 // default '/'
  autoActivate?: boolean;         // post SKIP_WAITING on update
  onUpdateReady?: () => void;
  onActivated?: () => void;
}): Promise<ServiceWorkerRegistration | null>;

unregisterJorvelServiceWorker(): Promise<boolean>;

// Inline source — useful for build-time injection
declare const JORVEL_SERVICE_WORKER_SOURCE: string;`}
      />

      <h2 id="shadow">Shadow DOM</h2>
      <CodeBlock
        language="ts"
        code={`<ShadowRemote
  mode?: 'open' | 'closed';       // default 'open'
  css?: string;                   // inlined into <style>
  stylesheets?: string[];         // resolved as <link rel="stylesheet">
>{children}</ShadowRemote>

scopeCss(css: string, scopePrefix: string): string;`}
      />

      <h2 id="islands">Islands</h2>
      <CodeBlock
        language="ts"
        code={`<Island
  strategy?: 'load' | 'idle' | 'visible' | 'media' | 'interaction';
  media?: string;                 // required when strategy === 'media'
  load: () => Promise<{ default: ComponentType<any> }>;
  fallback?: ReactNode;
  rootMargin?: string;            // IntersectionObserver fine-tuning
/>

clientBoundary<T>(component: T): T;     // marker for future tooling`}
      />

      <h2 id="loader">Remote loader</h2>
      <CodeBlock
        language="ts"
        code={`loadRemoteEntry({
  name: string;
  entryUrl: string;
  integrity?: string;             // SRI hash
}, opts?: {
  allowedOrigins?: string[];      // verified before fetch
  requireIntegrity?: boolean;     // fail closed when no SRI hash is present
  crossOrigin?: 'anonymous' | 'use-credentials' | 'none';
}): Promise<void>;

loadRemoteModule<T = unknown>(
  name: string,
  exposedKey: string,             // './App'
  opts?: { allowedOrigins?: string[]; integrity?: string },
): Promise<T>;

initRemoteContainer(name: string): Promise<void>;`}
      />

      <h2 id="registry">Remote registry</h2>
      <CodeBlock
        language="ts"
        code={`getRemoteRegistry(opts?: {
  allowedOrigins?: string[];
  fetcher?: typeof fetch;
}): RemoteRegistry;

class RemoteRegistry {
  register(d: RemoteDescriptor): void;
  unregister(name: string): void;
  get(name: string): RemoteDescriptor | undefined;
  list(): RemoteDescriptor[];
  load(manifestUrl: string): Promise<void>;
}`}
      />

      <h2 id="version">Version check</h2>
      <CodeBlock
        language="ts"
        code={`checkVersions({
  host: { name: string; version: string };
  remote: { name: string; version: string };
  singletons?: Record<string, string>;
}): Array<{ pkg: string; expected: string; actual: string }>;`}
      />

      <h2 id="health">Health</h2>
      <CodeBlock
        language="ts"
        code={`createHealthHandler(opts: {
  name: string;
  version: string;
  build?: string;
  shared?: Record<string, string>;
  probes?: Record<string, () => Promise<{ ok: boolean; detail?: string }>>;
}): (req: Request) => Promise<{ status: number; body: HealthBody }>;

fetchHealth(url: string, opts?: { timeoutMs?: number }): Promise<HealthBody>;`}
      />

      <h2 id="telemetry">Telemetry</h2>
      <ul>
        <li><code>onRemoteLoad(cb): () =&gt; void</code></li>
        <li><code>onRuntimeError(cb): () =&gt; void</code></li>
        <li><code>emitRemoteLoad(detail)</code> / <code>emitError(detail)</code></li>
        <li>DOM events: <code>jorvel:navigate</code>, <code>jorvel:remote-load</code>, <code>jorvel:error</code></li>
      </ul>

      <h2 id="dev-reload">Dev reload</h2>
      <ul>
        <li><code>connectJorvelDevReload(url?: string): () =&gt; void</code> — opens a WS to the host&apos;s reload server; auto-injected when <code>JORVEL_DEV_RELOAD_URL</code> is set</li>
      </ul>

      <h2 id="use-remote-data">useRemoteData</h2>
      <p>
        Small fetch + cache hook. Dedupes concurrent requests for the same key, TTLs the result,
        exposes <code>refresh</code> for forced revalidation. Pair with <code>defineLoader</code>{' '}
        on the server for end-to-end hydration.
      </p>
      <CodeBlock
        language="ts"
        code={`useRemoteData<T>(opts: {
  key: string | unknown[];
  fetcher: (signal: AbortSignal) => Promise<T>;
  ttl?: number;                       // ms, default 0 (no cache)
  initialData?: T;                    // from hydration
}): {
  data: T | undefined;
  error: unknown | undefined;
  loading: boolean;
  refresh(): Promise<void>;
};`}
      />

      <h2 id="revalidation">Cache tags &amp; revalidation</h2>
      <CodeBlock
        language="ts"
        code={`// tag a read: useRemoteData({ key, fetcher, tags: ['posts', 'post:42'] })
revalidateTag(tag: string): void;          // purge every entry with this tag + signal re-render
revalidatePath(path: string): void;        // sugar: revalidateTag(path)
invalidateRemoteData(key: string): void;   // purge one key
clearRemoteDataCache(): void;              // purge everything
prefetchRemoteData<T>(key, fetcher, ttl?, tags?): Promise<T>;
useRevalidationVersion(): number;          // subscribe a component to revalidation (re-renders on purge)`}
      />

      <h2 id="query">Query cache (useQuery / useMutation)</h2>
      <CodeBlock
        language="ts"
        code={`class QueryClient {
  constructor(opts?: { staleTime?: number; now?: () => number });
  fetchQuery<T>(key, queryFn): Promise<T>;   // dedupes in-flight
  setQueryData<T>(key, updater): void;        // optimistic / hydration
  invalidate(prefix | (key) => boolean): void;
  isStale(key, staleTime?): boolean;
  getEntry<T>(key); clear();
}
QueryClientProvider({ client?, children }); useQueryClient(): QueryClient;

useQuery<T>({ queryKey, queryFn, staleTime?, enabled? }):
  { data; error; status; isLoading; isFetching; isStale; refetch };

useMutation<I, O>({ mutationFn, onSuccess?, onError? }):
  { mutate; mutateAsync; data; error; status; isPending; reset };`}
      />

      <h2 id="optimistic">useOptimistic</h2>
      <CodeBlock
        language="ts"
        code={`// React-18-compatible; same shape as React 19's built-in
useOptimistic<State, Action = State>(
  state: State,
  updateFn: (current: State, optimisticValue: Action) => State,
): [optimisticState: State, addOptimistic: (action: Action) => void];`}
      />

      <h2 id="weighted">Weighted remotes</h2>
      <p>
        Pick among multiple URLs for the same remote, weighted by health and rollout percentage.
        Useful for canary deploys and CDN failover.
      </p>
      <CodeBlock
        language="ts"
        code={`createWeightedRemote(opts: {
  candidates: Array<{ entryUrl: string; weight: number; healthUrl?: string }>;
  probeIntervalMs?: number;       // default 30_000
  failoverOnError?: boolean;      // default true
}): { resolve(): Promise<string>; dispose(): void };`}
      />

      <h2 id="blue-green">Blue/green</h2>
      <p>
        Two-environment cutover with explicit <code>swap()</code>. Use when canary metrics are
        green and you want a deterministic flip.
      </p>
      <CodeBlock
        language="ts"
        code={`createBlueGreen(opts: {
  blue:  { entryUrl: string; version: string };
  green: { entryUrl: string; version: string };
  active?: 'blue' | 'green';
}): BlueGreenController;

interface BlueGreenController {
  active: 'blue' | 'green';
  swap(): void;
  resolve(): { entryUrl: string; version: string };
  subscribe(listener: (which: 'blue' | 'green') => void): () => void;
}`}
      />

      <h2 id="flags">Feature flags</h2>
      <p>
        Pluggable provider interface. Bring LaunchDarkly / Statsig / your-own and the runtime
        exposes a singleton with <code>useFeatureFlag</code> + <code>useFeatureFlags</code> hooks.
      </p>
      <CodeBlock
        language="ts"
        code={`interface FeatureFlagProvider {
  getBool(key: string, fallback?: boolean): boolean;
  getString(key: string, fallback?: string): string;
  getNumber(key: string, fallback?: number): number;
  subscribe(listener: () => void): () => void;
}

setFeatureFlagProvider(provider: FeatureFlagProvider): void;
useFeatureFlag(key: string, fallback?: boolean): boolean;
useFeatureFlags<T extends Record<string, boolean>>(keys: T): T;`}
      />

      <h2 id="resilience">Resilience</h2>
      <p>
        Retries with jittered backoff, circuit breaker, timeouts. Used internally by{' '}
        <code>loadRemoteEntry</code>; exposed for app-level fetches.
      </p>
      <CodeBlock
        language="ts"
        code={`withRetry<T>(fn: () => Promise<T>, opts?: {
  attempts?: number;              // default 3
  baseDelayMs?: number;           // default 200
  maxDelayMs?: number;            // default 5_000
  jitter?: number;                // 0..1, default 0.3
  shouldRetry?: (err: unknown, attempt: number) => boolean;
}): Promise<T>;

createCircuitBreaker(opts: {
  threshold: number;              // failures before opening
  resetMs: number;
}): {
  exec<T>(fn: () => Promise<T>): Promise<T>;
  state: 'closed' | 'open' | 'half';
};

withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T>;`}
      />

      <h2 id="fonts">Fonts</h2>
      <CodeBlock
        language="ts"
        code={`buildFontPreloadLink(href: string, opts?: { type?: string; crossorigin?: 'anonymous' | 'use-credentials' }): {
  rel: 'preload'; as: 'font'; href: string; type: string; crossorigin: string;
};

buildFontFaceCss(faces: Array<{
  family: string;
  src: string;
  weight?: number | string;
  style?: 'normal' | 'italic';
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  unicodeRange?: string;
}>): string;

googleFontsUrl(opts: { families: Array<{ family: string; weights: number[] | { italic: boolean; weight: number }[] }> }): string;
googleFontsPreconnectLinks(): Array<{ rel: 'preconnect'; href: string; crossorigin?: 'anonymous' }>;`}
      />

      <h2 id="image">Image</h2>
      <CodeBlock
        language="ts"
        code={`<Image
  src: string;
  alt: string;
  width: number;
  height: number;
  widths?: number[];
  formats?: Array<'avif' | 'webp' | 'jpg' | 'png'>;
  breakpoints?: Array<{ minWidth: number; size: string }>;
  fetchPriority?: 'high' | 'low' | 'auto';
  loading?: 'lazy' | 'eager';
/>

buildSrcset(template: string, opts: { widths: number[] } | { density: number[] }): string;
buildSizes(opts: { breakpoints: Array<{ minWidth: number; size: string }>; fallback: string }): string;
buildImagePreloadLink(template: string, opts: {
  widths?: number[];
  sizes?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
}): { rel: 'preload'; as: 'image'; imagesrcset: string; imagesizes?: string; fetchpriority?: string };`}
      />

      <h2 id="deprecation">Deprecation helper</h2>
      <p>
        Emits a one-time warning per call-site. Used by the runtime to flag removed APIs; usable
        in app code to retire internal helpers without breaking consumers immediately.
      </p>
      <CodeBlock
        language="ts"
        code={`deprecate(message: string, opts?: { since?: string; replacement?: string }): void;
deprecated<T extends (...args: any[]) => any>(fn: T, message: string): T;`}
      />
    </>
  );
}
