// Standalone dev entry: mount this remote into #root using its OWN exposed
// mount module — the exact same contract the host uses in production.
import remote from './remote';

const el = document.getElementById('root');
if (el) {
  remote.mount({
    el,
    subpath: window.location.pathname || '/',
    basePath: '/',
    params: {},
  });
}
