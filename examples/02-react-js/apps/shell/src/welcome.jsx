import React from 'react';

export function Welcome({ defaultProjectName }) {
  return (
    <main style={{ padding: 48, fontFamily: 'system-ui, sans-serif', maxWidth: 720 }}>
      <h1>Welcome to {defaultProjectName}</h1>
      <p>
        This is the host shell. Edit <code>src/welcome.jsx</code> to replace this screen,
        or remove the branch in <code>src/bootstrap.jsx</code> to route directly to a remote.
      </p>
      <p>
        Docs: <a href="https://jorveljs.vercel.app">jorveljs.vercel.app</a>
      </p>
    </main>
  );
}
