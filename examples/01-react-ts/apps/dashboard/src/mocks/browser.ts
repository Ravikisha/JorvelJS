import { setupWorker } from 'msw/browser';
import { handlers } from './handlers.js';

// In dev: await worker.start() before rendering to mock APIs in the browser.
export const worker = setupWorker(...handlers);
