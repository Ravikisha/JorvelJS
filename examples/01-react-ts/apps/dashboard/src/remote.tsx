import React from 'react';
import { RemoteApp, getFederatedRouter } from '@jorvel/runtime';
import { pages } from './jorvel.routes.js';

export default function RemoteRoot({ subpath = '/' }: { subpath?: string }) {
  const router = getFederatedRouter();

  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <header style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>dashboard (remote)</h2>
        <span style={{ fontSize: 12, opacity: 0.75 }}>shared router via <code>getFederatedRouter()</code></span>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button type="button" onClick={() => router.navigate('/')}>Go host home</button>
        <button
          type="button"
          onClick={() => router.navigate('/dashboard/settings')}
          title="Example of host navigation from inside a remote"
        >
          Go to /dashboard/settings
        </button>
      </div>

      <RemoteApp subpath={subpath} pages={pages} />
    </div>
  );
}
