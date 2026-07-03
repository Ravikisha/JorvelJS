import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getI18n, type FormatValues, type I18n } from './index.js';

const I18nContext = createContext<I18n | null>(null);

export interface I18nProviderProps {
  /** Optional explicit instance. Falls back to the globalThis-pinned singleton. */
  i18n?: I18n;
  children: ReactNode;
}

/**
 * Mount once high in the tree (host shell). Without an explicit `i18n` prop the
 * provider resolves the cross-MFE singleton via `getI18n()`, so remotes calling
 * `useT()` share the host's locale + catalogs even when bundled separately.
 */
export function I18nProvider({ i18n, children }: I18nProviderProps) {
  const value = useMemo(() => i18n ?? getI18n(), [i18n]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18nInstance(): I18n {
  // Context wins; otherwise fall back to the singleton so remotes work without
  // a provider in tests or stand-alone mode.
  const ctx = useContext(I18nContext);
  return ctx ?? getI18n();
}

/** Subscribe to locale/catalog changes, return the current instance. */
export function useI18n(): I18n {
  const i = useI18nInstance();
  const subscribe = useCallback((cb: () => void) => i.subscribe(cb), [i]);
  // Identity-only snapshot — re-renders happen when the instance notifies.
  // We use a tiny counter via the instance itself to stabilize the snapshot
  // against React's strict-mode double-invoke.
  const getSnapshot = useCallback(() => i.locale, [i]);
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return i;
}

/** Translate `key` with optional ICU-lite values. Re-renders on locale change. */
export function useT(): (key: string, values?: FormatValues) => string {
  const i = useI18n();
  return useCallback((key, values) => i.t(key, values), [i]);
}

/** Read the active locale + a setter. Setter is async — awaits catalog load. */
export function useLocale(): readonly [string, (locale: string) => Promise<void>] {
  const i = useI18n();
  const set = useCallback((l: string) => i.setLocale(l), [i]);
  return [i.locale, set] as const;
}

/** Render a single translated key. Useful for static strings in JSX. */
export interface TransProps {
  k: string;
  values?: FormatValues;
}
export function Trans({ k, values }: TransProps) {
  const t = useT();
  return <>{t(k, values)}</>;
}
