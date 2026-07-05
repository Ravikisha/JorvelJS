import React from 'react';
import { ErrorPage } from './pages/_error';

interface Props {
  children: React.ReactNode;
  /** Optional override. Defaults to the local pages/_error component. */
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Catches synchronous render errors anywhere below
 * and renders the local <ErrorPage>. Replace pages/_error.tsx to customize the
 * crash screen without touching this file.
 *
 * Async errors (promise rejections, event handlers) are not caught here —
 * use `window.addEventListener('unhandledrejection', ...)` for those.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Stack stays in the console for the React DevTools overlay.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught render error:', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    if (this.state.error) {
      const Fallback = this.props.fallback ?? ErrorPage;
      return <Fallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}
