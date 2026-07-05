import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  NavLink,
  RemoteOutlet,
  usePathname,
  getRouter,
  provideHostRouter,
  connectJorvelDevReload,
  type RouteTarget,
} from '@jorvel/runtime';
import { Welcome } from './welcome';
import { ErrorBoundary } from './error-boundary';
import { NotFoundPage } from './pages/_404';

import hostManifest from '../jorvel.routes.host.json';

const HOST_ROUTES: RouteTarget[] = (hostManifest as any).routes ?? [];

const REMOTES = {
  storefront: () => import('storefront/App'),
};

provideHostRouter(getRouter());

const reloadUrl = (import.meta as any).env.JORVEL_DEV_RELOAD_URL;
if (reloadUrl) connectJorvelDevReload({ url: reloadUrl });

/**
 * Returns true if any registered host route would handle the given pathname.
 * Patterns: "/x", "/x/*". Used to render the local 404 when nothing matches.
 */
function matchesAnyHostRoute(pathname: string, routes: RouteTarget[]): boolean {
  const norm = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  for (const r of routes) {
    const pattern = r.path.replace(/\/\*$/, '').replace(/^\/+/, '');
    if (pattern === '') return true;
    if (norm === pattern) return true;
    if (norm.startsWith(pattern + '/')) return true;
  }
  return false;
}

function App() {
  const pathname = usePathname();

  // First-run welcome screen at the workspace root. Delete this branch (and
  // src/welcome.tsx) once you're ready to ship your real shell home page.
  if (pathname === '/' || pathname === '') {
    return <Welcome defaultProjectName="shell" />;
  }

  // No host route matches → render the local 404. Override in
  // src/pages/_404.tsx.
  if (!matchesAnyHostRoute(pathname, HOST_ROUTES)) {
    return <NotFoundPage path={pathname} />;
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>
      <header
        style={{
          background: '#111827',
          color: 'white',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16 }}>JORVEL Shell</span>
        <nav style={{ marginLeft: 16, display: 'flex', gap: 4 }}>
          <NavLink to="/" label="Home" />
          <NavLink to="/storefront" label="storefront" />
          <NavLink to="/storefront/settings" label="Settings" />
        </nav>
        <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>{pathname}</span>
      </header>
      <main style={{ padding: 24 }}>
        <RemoteOutlet routes={HOST_ROUTES} remotes={REMOTES} />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
