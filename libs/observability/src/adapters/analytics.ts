/**
 * Generic pageview / event analytics adapters.
 *
 * Thin, SDK-free adapters that POST to the respective providers' HTTP ingest
 * endpoints via `fetch`. There are deliberately NO npm dependencies — each
 * adapter just shapes a payload and ships it. `fetch` is injectable so tests
 * never touch the network.
 *
 * Every concrete adapter implements `AnalyticsAdapter`:
 *   - `track(event)`    — a custom analytics event
 *   - `pageview(url)`   — a page view
 */

/** Minimal `fetch` signature we depend on — keeps the adapters injectable. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    keepalive?: boolean;
  },
) => Promise<{ ok: boolean; status: number }>;

export interface AnalyticsEvent {
  /** Event name, e.g. `'checkout_started'`. */
  name: string;
  /** Arbitrary event properties. */
  props?: Record<string, unknown>;
  /** Distinct/anonymous user id, when known. */
  distinctId?: string;
  /** URL the event happened on. Defaults to `location.href` in the browser. */
  url?: string;
}

export interface AnalyticsAdapter {
  /** Provider key, e.g. `'posthog'`. */
  readonly name: string;
  track(event: AnalyticsEvent): Promise<void>;
  pageview(url?: string): Promise<void>;
}

interface BaseOptions {
  /** Inject a `fetch` implementation (defaults to global `fetch`). */
  fetch?: FetchLike;
  /** Called when a request throws or returns a non-2xx status. Default: swallow. */
  onError?: (err: unknown) => void;
}

function resolveFetch(injected: FetchLike | undefined): FetchLike {
  if (injected) return injected;
  const f = (globalThis as { fetch?: FetchLike }).fetch;
  if (typeof f === 'function') return f;
  throw new Error('[jorvel/observability] no fetch available; pass `fetch` to the analytics adapter');
}

function currentUrl(explicit?: string): string | undefined {
  if (explicit !== undefined) return explicit;
  if (typeof location !== 'undefined') return location.href;
  return undefined;
}

async function post(
  fetchImpl: FetchLike,
  url: string,
  body: unknown,
  onError: ((err: unknown) => void) | undefined,
  headers: Record<string, string> = { 'content-type': 'application/json' },
): Promise<void> {
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (!res.ok) onError?.(new Error(`analytics request failed: ${res.status}`));
  } catch (err) {
    onError?.(err);
  }
}

/* ────────────────────────────── PostHog ────────────────────────────── */

export interface PosthogOptions extends BaseOptions {
  /** Project API key. */
  apiKey: string;
  /** Ingest host. Default: `https://us.i.posthog.com`. */
  host?: string;
  /** Default distinct id used when an event omits one. */
  distinctId?: string;
}

/** PostHog `/capture` adapter — POSTs `{ api_key, event, distinct_id, properties }`. */
export function posthogAdapter(opts: PosthogOptions): AnalyticsAdapter {
  const fetchImpl = resolveFetch(opts.fetch);
  const host = (opts.host ?? 'https://us.i.posthog.com').replace(/\/$/, '');
  const endpoint = `${host}/capture/`;

  const capture = (name: string, url: string | undefined, props: Record<string, unknown>, distinctId?: string) => {
    const properties: Record<string, unknown> = { ...props };
    if (url !== undefined) properties['$current_url'] = url;
    return post(
      fetchImpl,
      endpoint,
      {
        api_key: opts.apiKey,
        event: name,
        distinct_id: distinctId ?? opts.distinctId ?? 'anonymous',
        properties,
      },
      opts.onError,
    );
  };

  return {
    name: 'posthog',
    track(event) {
      return capture(event.name, currentUrl(event.url), event.props ?? {}, event.distinctId);
    },
    pageview(url) {
      return capture('$pageview', currentUrl(url), {});
    },
  };
}

/* ────────────────────────────── Plausible ────────────────────────────── */

export interface PlausibleOptions extends BaseOptions {
  /** The site domain registered in Plausible, e.g. `'shop.example.com'`. */
  domain: string;
  /** Ingest host. Default: `https://plausible.io`. */
  host?: string;
}

/**
 * Plausible `/api/event` adapter — POSTs `{ name, domain, url, props }`.
 * Plausible identifies a pageview by `name: 'pageview'`.
 */
export function plausibleAdapter(opts: PlausibleOptions): AnalyticsAdapter {
  const fetchImpl = resolveFetch(opts.fetch);
  const host = (opts.host ?? 'https://plausible.io').replace(/\/$/, '');
  const endpoint = `${host}/api/event`;

  const send = (name: string, url: string | undefined, props?: Record<string, unknown>) => {
    // Plausible requires an absolute URL; fall back to the domain root.
    const resolvedUrl = url ?? `https://${opts.domain}/`;
    const payload: Record<string, unknown> = {
      name,
      domain: opts.domain,
      url: resolvedUrl,
    };
    if (props && Object.keys(props).length > 0) payload['props'] = props;
    return post(fetchImpl, endpoint, payload, opts.onError);
  };

  return {
    name: 'plausible',
    track(event) {
      return send(event.name, currentUrl(event.url), event.props);
    },
    pageview(url) {
      return send('pageview', currentUrl(url));
    },
  };
}

/* ────────────────────────── Vercel Analytics ────────────────────────── */

export interface VercelAnalyticsOptions extends BaseOptions {
  /** Ingest endpoint. Default: `/_vercel/insights/event` (same-origin). */
  endpoint?: string;
}

/**
 * Vercel Web Analytics adapter — POSTs to the insights collector. Events use
 * `{ type: 'event', name, data }`; pageviews use `{ type: 'pageview', url }`.
 */
export function vercelAnalyticsAdapter(opts: VercelAnalyticsOptions = {}): AnalyticsAdapter {
  const fetchImpl = resolveFetch(opts.fetch);
  const endpoint = opts.endpoint ?? '/_vercel/insights/event';

  return {
    name: 'vercel',
    track(event) {
      const payload: Record<string, unknown> = { type: 'event', name: event.name };
      if (event.props) payload['data'] = event.props;
      const url = currentUrl(event.url);
      if (url !== undefined) payload['url'] = url;
      return post(fetchImpl, endpoint, payload, opts.onError);
    },
    pageview(url) {
      const payload: Record<string, unknown> = { type: 'pageview' };
      const resolved = currentUrl(url);
      if (resolved !== undefined) payload['url'] = resolved;
      return post(fetchImpl, endpoint, payload, opts.onError);
    },
  };
}
