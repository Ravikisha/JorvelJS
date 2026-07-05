import React from 'react';
import { ErrorPage } from './pages/_error';

/**
 * Top-level error boundary. Catches synchronous render errors anywhere below
 * and renders the local <ErrorPage>. Replace pages/_error.jsx to customize the
 * crash screen without touching this file.
 *
 * Async errors (promise rejections, event handlers) are not caught here —
 * use `window.addEventListener('unhandledrejection', ...)` for those.
 */
export class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught render error:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const Fallback = this.props.fallback ?? ErrorPage;
      return <Fallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}
