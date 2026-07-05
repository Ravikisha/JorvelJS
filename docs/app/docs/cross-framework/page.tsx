import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Cross-framework remotes',
  description:
    'The framework-neutral mount contract (@jorvel/mount) lets a JORVEL host embed a remote built with any framework — React, Vue, Angular, Solid, Svelte — via mount(ctx)/unmount.',
};

export default function CrossFramework() {
  return (
    <>
      <h1>Cross-framework remotes</h1>
      <p>
        Module Federation federates <em>JS modules</em>, not React components — the transport is
        already framework-agnostic. What used to tie a JORVEL remote to React was the{' '}
        <strong>contract</strong>: a remote exposed a React component and the host rendered it into
        its React tree. JORVEL now also speaks a <strong>framework-neutral mount contract</strong>,
        so a host can embed a remote built with <em>any</em> framework.
      </p>

      <h2 id="contract">The contract</h2>
      <p>
        A remote exposes a <code>mount(ctx)</code> / <code>unmount(el)</code> module
        (<code>@jorvel/mount</code>). The host hands it a DOM node + context; the remote bootstraps
        whatever framework it wants into that node and returns a disposer. The host never imports the
        remote&apos;s framework.
      </p>
      <CodeBlock
        language="ts"
        filename="@jorvel/mount"
        code={`export interface JorvelMountModule {
  mount(ctx: JorvelMountContext): void | JorvelUnmount | Promise<void | JorvelUnmount>;
  unmount?(el: HTMLElement): void;
}

export interface JorvelMountContext {
  el: HTMLElement;                    // the node the remote owns
  subpath: string;                    // path relative to the mount prefix
  basePath: string;                   // the prefix the host mounted under
  params: Record<string, string>;     // route params matched by the host
  props?: Record<string, unknown>;    // host-passed props
  signal?: AbortSignal;               // aborted on unmount / navigation
}`}
      />

      <h2 id="react">React remotes</h2>
      <p>
        React remotes get the contract for free with <code>@jorvel/adapter-react</code>. Wrap your
        root and the remote is mountable by any host:
      </p>
      <CodeBlock
        language="tsx"
        filename="apps/dashboard/src/remote.tsx"
        code={`import { defineReactRemote } from '@jorvel/adapter-react';
import { RemoteApp } from '@jorvel/runtime';
import { pages } from './jorvel.routes.js';

export default defineReactRemote(({ subpath }) => (
  <RemoteApp subpath={subpath} pages={pages} />
));`}
      />
      <Callout variant="info" title="Back-compat preserved">
        Remotes that still <code>export default</code> a React component keep working unchanged —
        <code>RemoteOutlet</code> renders a component default directly and only takes the mount path
        when it detects a mount module. Nothing to migrate.
      </Callout>

      <h2 id="other">Other frameworks</h2>
      <p>Implement the contract directly — here a Vue remote:</p>
      <CodeBlock
        language="ts"
        filename="apps/pricing/src/remote.ts"
        code={`import type { JorvelMountModule } from '@jorvel/mount';
import { createApp } from 'vue';
import Root from './Root.vue';

const remote: JorvelMountModule = {
  mount({ el, subpath }) {
    const app = createApp(Root, { subpath });
    app.mount(el);
    return () => app.unmount();
  },
};
export default remote;`}
      />
      <p>Solid, Svelte (<code>customElement</code>), Angular (<code>ApplicationRef</code>), or plain DOM follow the same shape.</p>

      <h2 id="host">On the host</h2>
      <p>
        Nothing changes. <code>RemoteOutlet</code> auto-detects: a mount module is bridged into a DOM
        node it owns (with the neutral context), a React-component default is rendered inline. A
        plain-DOM host can mount without React using <code>mountRemoteModule</code>:
      </p>
      <CodeBlock
        language="ts"
        code={`import { asMountModule, mountRemoteModule } from '@jorvel/mount';

const mod = asMountModule(await importRemote());
if (mod) {
  const dispose = mountRemoteModule(mod, { el, subpath, basePath, params });
  // …on navigation away:
  dispose();
}`}
      />

      <h2 id="web-component">Embed anywhere: Web Component mode</h2>
      <p>
        For a host that <em>isn&apos;t</em> a JORVEL app — plain HTML, a CMS, or a page owned by
        another framework — wrap any mount module as a custom element. It reads routing context from
        attributes and drives the mount lifecycle from connect/disconnect:
      </p>
      <CodeBlock
        language="ts"
        code={`import { defineCustomElement } from '@jorvel/mount';
import remote from './remote.js'; // any JorvelMountModule

defineCustomElement('jorvel-pricing', remote);           // light DOM (host CSS applies)
// defineCustomElement('jorvel-pricing', remote, { shadow: true }); // isolated shadow DOM`}
      />
      <CodeBlock
        language="html"
        code={`<!-- Now usable in ANY page, no framework required -->
<jorvel-pricing subpath="/plans" basepath="/pricing" params='{"tier":"pro"}'></jorvel-pricing>`}
      />
      <p>
        Extra attributes can be forwarded as props via{' '}
        <code>{`{ observedAttributes: ['data-theme'] }`}</code> (kebab-case arrives camelCased). The
        element re-mounts when <code>subpath</code> changes and tears down on removal.
      </p>

      <h2 id="ssr">Cross-framework SSR</h2>
      <p>
        Server-render each framework&apos;s fragment, stitch them into one document, and hydrate
        each on the client — all through the neutral <code>@jorvel/mount/ssr</code> primitives.
      </p>
      <p>
        <strong>1. Expose a server module.</strong> Alongside the client mount module, a remote
        exposes a <code>renderToString</code> (React does this via{' '}
        <code>@jorvel/adapter-react/server</code>):
      </p>
      <CodeBlock
        language="tsx"
        filename="remote.server.tsx (exposed as ./AppServer)"
        code={`import { defineReactServerRemote } from '@jorvel/adapter-react/server';
import Root from './Root';
export default defineReactServerRemote(Root, { getState: (ctx) => ({ id: ctx.params.id }) });`}
      />
      <p>
        <strong>2. Render + stitch on the server.</strong> Run each remote&apos;s renderer and compose
        the fragments into a document:
      </p>
      <CodeBlock
        language="ts"
        code={`import { renderFragment, composeFragments } from '@jorvel/mount/ssr';

const ctx = { subpath: '/plans', basePath: '/pricing', params: {} };
const fragments = await Promise.all([
  renderFragment('pricing', pricingServer, ctx),   // Vue
  renderFragment('reports', reportsServer, ctx),   // Angular
]);
const { html } = composeFragments(fragments, { template: shellHtml }); // {{head}} {{body}} {{state}}`}
      />
      <p>
        Each fragment is wrapped in a marked mount point (
        <code>data-jorvel-fragment=&quot;pricing&quot;</code>) and its hydration state is serialized
        (XSS-safe) into a single script tag.
      </p>
      <p>
        <strong>3. Hydrate on the client.</strong> One call finds every fragment, loads its remote,
        and re-mounts with <code>hydrate: true</code> — reusing the server DOM and seeding{' '}
        <code>initialState</code>:
      </p>
      <CodeBlock
        language="ts"
        code={`import { hydrateFragments } from '@jorvel/mount/ssr';

await hydrateFragments({
  pricing: () => import('pricing/App'),
  reports: () => import('reports/App'),
});`}
      />
      <p>
        Every framework ships a server entry — <code>@jorvel/adapter-&lt;fw&gt;/server</code> with{' '}
        <code>define&lt;Fw&gt;ServerRemote</code> (React via <code>react-dom/server</code>, Vue via{' '}
        <code>@vue/server-renderer</code>, Solid via <code>solid-js/web</code>, Svelte via{' '}
        <code>svelte/server</code>, Angular via <code>@angular/platform-server</code>). On the client,
        adapters honor <code>ctx.hydrate</code>: React <code>hydrateRoot</code>, Vue{' '}
        <code>createSSRApp</code>, Solid <code>hydrate</code>, Svelte <code>hydrate</code>. Angular
        renders server-side and mounts on the client (app-level{' '}
        <code>provideClientHydration</code> for full DOM reuse).
      </p>

      <h2 id="tradeoffs">Trade-offs</h2>
      <ul>
        <li>
          <strong>Shared runtime.</strong> The React singleton only dedupes React remotes. A Vue
          remote ships Vue, an Angular remote ships Angular — polyglot means a heavier baseline.
          Worth it only if you genuinely run mixed stacks.
        </li>
        <li>
          <strong>Communication is neutral.</strong> No shared React context across the boundary —
          use <code>@jorvel/event-bus</code> / <code>@jorvel/state</code> (plain-JS pub/sub) or DOM
          <code>CustomEvent</code>s.
        </li>
        <li>
          <strong>Typed routes stay React-only.</strong> Foreign frameworks get the neutral contract;
          full TS route typing is a React-adapter perk.
        </li>
        <li>
          <strong>SSR.</strong> Each framework has its own server renderer — cross-framework SSR is
          opt-in per adapter; CSR-first for non-React remotes.
        </li>
      </ul>
    </>
  );
}
