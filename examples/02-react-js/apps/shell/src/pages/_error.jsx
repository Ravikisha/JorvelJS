import React from 'react';

// Rspack replaces `process.env.NODE_ENV` at build time (optimization.nodeEnv
// defaults to `mode`), so this is a static boolean in the bundle. The old
// `typeof process !== 'undefined' ? … : true` form was NOT replaced in the
// browser (where `typeof process` is 'undefined') and so leaked the dev crash
// screen + full stack traces into production builds.
const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Default crash screen. In development this shows the full message + stack so
 * you can fix the bug without leaving the browser. In production it falls back
 * to a generic, brand-safe message.
 *
 * Override by editing this file — it is yours, not a framework dependency.
 */
export function ErrorPage({ error, reset }) {
  return (
    <main
      role="alert"
      style={{
        minHeight: '100vh',
        padding: '48px 32px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: IS_DEV ? '#1f1023' : '#fafafa',
        color: IS_DEV ? '#fbe2ec' : '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto', width: '100%' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: 999,
            background: IS_DEV ? '#7f1d1d' : '#e5e7eb',
            color: IS_DEV ? '#fee2e2' : '#374151',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {IS_DEV ? 'Runtime error · development' : 'Something went wrong'}
        </div>

        <h1
          style={{
            marginTop: 16,
            fontSize: 32,
            lineHeight: 1.15,
            fontWeight: 700,
          }}
        >
          {IS_DEV ? error.message : "We hit an unexpected error."}
        </h1>

        {IS_DEV ? (
          <>
            <p style={{ opacity: 0.85, fontSize: 14, marginTop: 8 }}>
              The application threw during render. Fix the cause, save, and the dev
              server will reload automatically.
            </p>
            <pre
              style={{
                marginTop: 24,
                padding: 20,
                borderRadius: 8,
                background: '#0f0a13',
                color: '#fcd9e6',
                overflowX: 'auto',
                fontSize: 12,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.stack ?? String(error)}
            </pre>
          </>
        ) : (
          <p style={{ opacity: 0.75, marginTop: 12 }}>
            The error has been logged. Please refresh the page or return home.
          </p>
        )}

        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => (reset ? reset() : window.location.reload())}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: '#a3e635',
              color: '#0a0a0a',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: '1px solid currentColor',
              textDecoration: 'none',
              color: 'inherit',
              fontWeight: 600,
            }}
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}

export default ErrorPage;
