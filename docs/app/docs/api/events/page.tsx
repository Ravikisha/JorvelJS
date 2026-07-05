import { CodeBlock } from '@/components/site/code-block';

export const metadata = {
  title: '@jorvel/events API',
  description: 'The shared event-contract type map (MfAppEvents) consumed by host + remotes via the singleton event bus.',
};

export default function EventsApi() {
  return (
    <>
      <h1>@jorvel/events</h1>
      <p>
        A tiny, dependency-free package that holds the <strong>event contract</strong> — the typed
        map of event names → payloads shared across every micro-frontend. Because{' '}
        <code>@jorvel/event-bus</code> is a Module Federation singleton, an event a host emits is
        received by handlers a remote registered, and vice-versa. Keeping the contract in one package
        gives both sides the same types.
      </p>

      <h2 id="map">MfAppEvents</h2>
      <CodeBlock
        language="ts"
        code={`import { getEventBus } from '@jorvel/event-bus';
import type { MfAppEvents } from '@jorvel/events';

const bus = getEventBus<MfAppEvents>();

bus.emit('shell:ready', { timestamp: Date.now() });        // host
const off = bus.on('shell:ready', ({ timestamp }) => {}); // remote — fully typed payload`}
      />

      <h2 id="extend">Extending the contract</h2>
      <p>
        Own your app&apos;s events by defining your own map (this package is a starter). Any{' '}
        <code>Record&lt;string, unknown&gt;</code> works with <code>getEventBus&lt;T&gt;()</code>.
      </p>
      <CodeBlock
        language="ts"
        code={`export interface AppEvents {
  'cart:add': { sku: string; qty: number };
  'auth:login': { userId: string };
  'shell:ready': { timestamp: number };
}
// share this type across host + remotes (a workspace package or a federated contract)`}
      />
      <p>
        See <a href="/docs/api/event-bus">@jorvel/event-bus</a> for the runtime (emit/on/once,
        wildcard, replay, schema validation, cross-tab broadcast).
      </p>
    </>
  );
}
