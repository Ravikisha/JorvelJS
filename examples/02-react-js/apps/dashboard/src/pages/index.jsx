import React from 'react';

const wrap: React.CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.25rem', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' };
const badge: React.CSSProperties = { display: 'inline-block', fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '4px 11px', borderRadius: 999 };
const card: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', background: '#fff' };
const btn: React.CSSProperties = { cursor: 'pointer', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg,#6366f1,#22d3ee)', fontSize: 15 };

const FEATURES: Array<[string, string]> = [
  ['File-based routing', 'Drop a file in src/pages/ — it becomes a route.'],
  ['Federated at runtime', 'The host loads this remote over Module Federation.'],
  ['Crash-isolated', 'A render error shows a boundary, never white-screens the app.'],
];

/** dashboard — home route ("/"). Edit this file; it hot-reloads. */
export default function HomePage() {
  const [count, setCount] = React.useState(0);
  return (
    <div style={wrap}>
      <span style={badge}>dashboard · remote</span>
      <h1 style={{ fontSize: '2.1rem', lineHeight: 1.15, margin: '16px 0 8px' }}>It works! 🎉</h1>
      <p style={{ color: '#475569', fontSize: '1.06rem', margin: 0 }}>
        This page is served by the <strong>dashboard</strong> remote and mounted into the host via
        Module Federation. Edit <code>src/pages/index.jsx</code> and save — it hot-reloads.
      </p>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', margin: '28px 0' }}>
        {FEATURES.map(([title, desc]) => (
          <div key={title} style={card}>
            <div style={{ fontWeight: 600 }}>{title}</div>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>{desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button style={btn} onClick={() => setCount((c) => c + 1)}>Clicked {count} time{count === 1 ? '' : 's'}</button>
        <span style={{ color: '#94a3b8', fontSize: 14 }}>← live React state, proving it&apos;s a real running app</span>
      </div>
    </div>
  );
}
