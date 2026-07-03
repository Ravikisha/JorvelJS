import { renderSnapshot } from './render.mjs';

const root = document.getElementById('root');

// Read window.__JORVEL__ from the inspected page and re-render on a poll.
function refresh() {
  chrome.devtools.inspectedWindow.eval(
    'JSON.parse(JSON.stringify(window.__JORVEL__ || null))',
    (result, err) => {
      if (root) root.innerHTML = renderSnapshot(err ? null : result);
    },
  );
}

refresh();
setInterval(refresh, 1000);
