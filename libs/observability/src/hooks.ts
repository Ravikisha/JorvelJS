export type Severity = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface MetricEvent {
  name: string;
  value: number;
  unit?: 'ms' | 'bytes' | 'count';
  tags?: Record<string, string | number>;
}

export interface RemoteLoadEvent {
  remote: string;
  url: string;
  phase: 'start' | 'success' | 'error' | 'timeout';
  durationMs?: number;
  error?: unknown;
}

export interface ErrorEvent {
  error: unknown;
  context?: Record<string, unknown>;
  severity?: Severity;
  source?: 'runtime' | 'remote' | 'ssr' | 'user';
}

export type ErrorHandler = (e: ErrorEvent) => void;
export type MetricHandler = (m: MetricEvent) => void;
export type RemoteLoadHandler = (e: RemoteLoadEvent) => void;

interface Registry {
  errors: Set<ErrorHandler>;
  metrics: Set<MetricHandler>;
  remoteLoads: Set<RemoteLoadHandler>;
}

// Anchor the registry on globalThis via a well-known Symbol. In a module-
// federation app the host and each remote may bundle their OWN copy of
// @jorvel/observability; a module-local registry would mean a handler registered
// in one copy never sees events reported through another. Sharing one registry
// across copies makes observability work across the MF boundary.
const REGISTRY_KEY = Symbol.for('jorvel.observability.hooks');

function getRegistry(): Registry {
  const g = globalThis as typeof globalThis & { [REGISTRY_KEY]?: Registry };
  if (!g[REGISTRY_KEY]) {
    g[REGISTRY_KEY] = {
      errors: new Set(),
      metrics: new Set(),
      remoteLoads: new Set(),
    };
  }
  return g[REGISTRY_KEY];
}

const reg: Registry = getRegistry();

export function onError(fn: ErrorHandler): () => void {
  reg.errors.add(fn);
  return () => reg.errors.delete(fn);
}

export function onMetric(fn: MetricHandler): () => void {
  reg.metrics.add(fn);
  return () => reg.metrics.delete(fn);
}

export function onRemoteLoad(fn: RemoteLoadHandler): () => void {
  reg.remoteLoads.add(fn);
  return () => reg.remoteLoads.delete(fn);
}

export function reportError(e: ErrorEvent): void {
  for (const h of reg.errors) safeCall(() => h(e));
}

export function reportMetric(m: MetricEvent): void {
  for (const h of reg.metrics) safeCall(() => h(m));
}

export function reportRemoteLoad(e: RemoteLoadEvent): void {
  for (const h of reg.remoteLoads) safeCall(() => h(e));
}

export function clearHandlers(): void {
  reg.errors.clear();
  reg.metrics.clear();
  reg.remoteLoads.clear();
}

function safeCall(fn: () => void): void {
  try {
    fn();
  } catch {
    // swallow — observer must never break the host
  }
}
