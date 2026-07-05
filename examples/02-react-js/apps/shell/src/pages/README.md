# Error & 404 pages

These two files are part of your app, not the framework. Edit them freely.

| File | Renders when |
| --- | --- |
| `_error.jsx` | An uncaught render error bubbles to the top-level `<ErrorBoundary>` (see `src/error-boundary.jsx`). In `NODE_ENV !== "production"` the stack trace is shown inline. |
| `_404.jsx` | The current URL is not matched by any entry in `jorvel.routes.host.json`. |

## Override

- **Replace inline** — edit `_error.jsx` or `_404.jsx` directly. Both files use no framework imports beyond React.
- **Swap component** — pass a custom `fallback` to the boundary:

  ```jsx
  <ErrorBoundary fallback={MyCustomErrorPage}>
    <App />
  </ErrorBoundary>
  ```

- **Disable the boundary** — remove `<ErrorBoundary>` from `bootstrap.jsx` to fall back to React's default red-screen behavior in production builds.

## Async errors

React error boundaries only catch errors thrown during render. To capture
promise rejections (data fetching, dynamic imports), add a global listener:

```js
window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason);
});
```
