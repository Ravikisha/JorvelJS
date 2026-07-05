import React from 'react';

/**
 * Default 404 page. Rendered when no host route matches the current path.
 * Override by editing this file — it is yours.
 */
export function NotFoundPage({ path }: { path?: string }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '64px 32px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'grid',
        placeItems: 'center',
        background: '#fafafa',
        color: '#0a0a0a',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 540 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            color: '#a3e635',
            marginBottom: 12,
            textTransform: 'uppercase',
          }}
        >
          404 · Not found
        </p>
        <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: 0, fontWeight: 800 }}>
          This page does not exist.
        </h1>
        {path ? (
          <p style={{ marginTop: 16, opacity: 0.7, fontFamily: 'ui-monospace, monospace' }}>
            <code>{path}</code>
          </p>
        ) : null}
        <p style={{ marginTop: 16, opacity: 0.8 }}>
          The URL was not matched by any host route. If you expect a remote to
          handle it, make sure it is registered in <code>jorvel.routes.host.json</code>.
        </p>
        <div style={{ marginTop: 28, display: 'inline-flex', gap: 12 }}>
          <a
            href="/"
            style={{
              padding: '10px 18px',
              background: '#0a0a0a',
              color: 'white',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Go home
          </a>
          <a
            href="https://jorveljs.vercel.app/docs"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '10px 18px',
              border: '1px solid #0a0a0a',
              color: '#0a0a0a',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            JORVEL docs
          </a>
        </div>
      </div>
    </main>
  );
}

export default NotFoundPage;
