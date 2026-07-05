// Async boundary — keeps all imports deferred until Module Federation has
// initialized the shared scope. Without this, shared deps (react, etc.) are
// required synchronously before MF registers the singleton, causing
// RUNTIME-006 (loadShareSync failure).
import './styles.css';
import('./bootstrap');
