// Type declarations for Module Federation remote modules.
// Resolved at runtime by Rspack's federation plugin.
declare module 'marketing/App' {
  import type React from 'react';
  const RemoteApp: React.ComponentType<{ subpath?: string }>;
  export default RemoteApp;
}
