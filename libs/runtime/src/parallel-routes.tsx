/**
 * @jorvel/runtime — parallel routes / named slots (Next.js `@modal` / `@sidebar`).
 *
 * A layout can render several independent matched subtrees at once, each keyed
 * by a slot *name*. Every slot has its own route table and matches the current
 * pathname independently of the others, so e.g. a `@sidebar` slot can stay on
 * its section route while the main content navigates, and a `@modal` slot can
 * pop open for `/photo/:id` over the top of the page that opened it.
 *
 * ── API ──────────────────────────────────────────────────────────────────────
 *
 *   const slots = defineSlots({
 *     modal:   [{ path: '/photo/:id', element: <Photo /> }],
 *     sidebar: [{ path: '/team/*',    element: <Team /> }],
 *   });
 *
 *   function Layout() {
 *     return (
 *       <ParallelRoutes slots={slots}>
 *         <main>{children}</main>
 *         <SlotOutlet name="modal" />          // renders matched modal subtree
 *         <SlotOutlet name="sidebar"
 *           fallback={<DefaultSidebar />} />   // fallback when nothing matches
 *       </ParallelRoutes>
 *     );
 *   }
 *
 * `<SlotOutlet>` renders the element of the slot's first matching route, or its
 * `fallback` (then `null`) when nothing matches. `useSlot(name)` returns the
 * raw match (`{ element, params } | null`) for custom rendering.
 *
 * ── Intercepting routes ───────────────────────────────────────────────────────
 *
 * A slot route can declare `intercept: true`. When the URL matches an
 * intercepting route, the slot renders it BUT the slot also reports an
 * `interceptedFrom` path — the pathname the user was on *before* the intercept,
 * captured by {@link InterceptionTracker}. This lets the main content keep
 * rendering the previous page (modal-over-page) instead of full-navigating.
 * Read it with `useInterceptedBase()` and feed it to your main router.
 *
 * Built on `matchPath` + `usePathname` — no new deps. SSR-safe: matching is pure
 * and `usePathname` falls back to the server router under SSR.
 */

import React from 'react';
import { matchPath } from './route-matcher.js';
import { usePathname } from './routing.js';

export interface SlotRoute {
  /** Match pattern — same syntax as the route matcher (`:param`, `*`). */
  path: string;
  /** Element rendered when this route matches within the slot. */
  element: React.ReactNode;
  /**
   * Mark this as an intercepting route. While it matches, the slot opens over
   * the previously-visible page rather than replacing the main content.
   */
  intercept?: boolean;
}

/** A resolved slot match handed to consumers via {@link useSlot}. */
export interface SlotMatch {
  element: React.ReactNode;
  params: Record<string, string>;
  /** True when the matched route declared `intercept`. */
  intercepted: boolean;
}

/** Named slot definitions: slot name → its route table. */
export type SlotsDefinition = Record<string, SlotRoute[]>;

/**
 * Identity helper that returns the slots map unchanged, for inference + editor
 * hints. `const slots = defineSlots({ modal: [...], sidebar: [...] })`.
 */
export function defineSlots<T extends SlotsDefinition>(slots: T): T {
  return slots;
}

interface ParallelContextValue {
  slots: SlotsDefinition;
  pathname: string;
}

const ParallelContext = React.createContext<ParallelContextValue | null>(null);

/** Pure: match a pathname against one slot's route table. */
export function matchSlot(routes: SlotRoute[], pathname: string): SlotMatch | null {
  for (const route of routes) {
    const m = matchPath(route.path, pathname);
    if (!m) continue;
    return {
      element: route.element,
      params: m.params,
      intercepted: route.intercept === true,
    };
  }
  return null;
}

export interface ParallelRoutesProps {
  slots: SlotsDefinition;
  children?: React.ReactNode;
  /** Override the pathname used for matching (testing / nested mounts). */
  pathname?: string;
}

/**
 * Provides the slot definitions + current pathname to descendant
 * `<SlotOutlet>` / `useSlot` consumers. Renders its children as-is — the layout
 * decides where each `<SlotOutlet>` goes.
 */
export function ParallelRoutes({ slots, children, pathname: pathnameProp }: ParallelRoutesProps): React.ReactElement {
  const routerPathname = usePathname();
  const pathname = pathnameProp ?? routerPathname;

  const value = React.useMemo<ParallelContextValue>(
    () => ({ slots, pathname }),
    [slots, pathname],
  );

  return <ParallelContext.Provider value={value}>{children}</ParallelContext.Provider>;
}

/**
 * Returns the current match for a named slot, or `null`. Throws if used outside
 * a `<ParallelRoutes>` provider so misuse fails loudly in dev.
 */
export function useSlot(name: string): SlotMatch | null {
  const ctx = React.useContext(ParallelContext);
  if (!ctx) {
    throw new Error(`useSlot("${name}") must be used inside <ParallelRoutes>.`);
  }
  const routes = ctx.slots[name];
  return React.useMemo(
    () => (routes ? matchSlot(routes, ctx.pathname) : null),
    [routes, ctx.pathname],
  );
}

export interface SlotOutletProps {
  name: string;
  /** Rendered when the slot has no matching route. Default `null`. */
  fallback?: React.ReactNode;
}

/**
 * Renders the matched element for the named slot, or `fallback` (then nothing)
 * when no route in that slot matches the current pathname.
 */
export function SlotOutlet({ name, fallback = null }: SlotOutletProps): React.ReactElement {
  const match = useSlot(name);
  return <>{match ? match.element : fallback}</>;
}

// ── Intercepting routes ────────────────────────────────────────────────────────

interface InterceptionContextValue {
  /** Pathname the user was on before the current (possibly intercepted) one. */
  previous: string | null;
}

const InterceptionContext = React.createContext<InterceptionContextValue>({ previous: null });

/**
 * Tracks the previously-visited pathname so intercepting slots can keep the main
 * content on the page that opened them. Wrap your app (above `<ParallelRoutes>`)
 * with this once.
 */
export function InterceptionTracker({ children }: { children?: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const previousRef = React.useRef<string | null>(null);
  const currentRef = React.useRef<string>(pathname);

  // On each pathname change, shift current → previous BEFORE recording the new
  // one, so `previous` is always the path we navigated away from.
  if (currentRef.current !== pathname) {
    previousRef.current = currentRef.current;
    currentRef.current = pathname;
  }

  const value = React.useMemo<InterceptionContextValue>(
    () => ({ previous: previousRef.current }),
    [pathname],
  );

  return <InterceptionContext.Provider value={value}>{children}</InterceptionContext.Provider>;
}

/**
 * Returns the base pathname the main content should render while an intercepting
 * slot is open: the previous path when any slot currently has an intercepting
 * match, otherwise the live pathname. Use this to drive the main router so the
 * underlying page stays put behind a modal.
 *
 * Must be used inside `<ParallelRoutes>`; `<InterceptionTracker>` is optional
 * (without it there is no previous path, so the live pathname is returned).
 */
export function useInterceptedBase(): string {
  const ctx = React.useContext(ParallelContext);
  if (!ctx) {
    throw new Error('useInterceptedBase() must be used inside <ParallelRoutes>.');
  }
  const { previous } = React.useContext(InterceptionContext);

  const hasIntercept = React.useMemo(() => {
    for (const routes of Object.values(ctx.slots)) {
      const m = matchSlot(routes, ctx.pathname);
      if (m?.intercepted) return true;
    }
    return false;
  }, [ctx.slots, ctx.pathname]);

  return hasIntercept && previous !== null ? previous : ctx.pathname;
}
