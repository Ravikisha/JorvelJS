import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@jorvel/i18n',
  description:
    'Tiny ICU-lite interpolation, lazy catalogs, locale detection. Works on the server (Accept-Language) and the client.',
};

export default function I18nPage() {
  return (
    <>
      <h1>@jorvel/i18n</h1>
      <p>
        A ~3 KB i18n primitive shaped after ICU MessageFormat: simple placeholders, plural arms,
        number formatting, lazy catalogs, change-listener for re-rendering on locale swap. No
        dependencies beyond <code>Intl</code> — runs on Node, the browser, and edge workers.
      </p>

      <h2 id="quickstart">Quickstart</h2>
      <CodeBlock
        language="ts"
        code={`import { createI18n } from '@jorvel/i18n';

const i18n = createI18n({
  locale: 'en',
  fallbackLocale: 'en',
  catalogs: {
    en: {
      greet: 'Hello, {name}',
      items: '{count, plural, =0 {No items} one {# item} other {# items}}',
    },
    fr: {
      greet: 'Bonjour, {name}',
      items: '{count, plural, =0 {Aucun élément} one {# article} other {# articles}}',
    },
  },
});

i18n.t('greet', { name: 'Ada' });            // 'Hello, Ada'
i18n.t('items', { count: 3 });               // '3 items'

await i18n.setLocale('fr');
i18n.t('items', { count: 0 });               // 'Aucun élément'`}
      />

      <h2 id="singleton">Shared singleton across micro-frontends</h2>
      <p>
        <code>createI18n</code> makes an isolated instance. In a federated app the host and each
        remote bundle their own copy of <code>@jorvel/i18n</code>, so they would each get a different
        instance — and a different active locale. <code>getI18n</code> pins one instance to{' '}
        <code>globalThis</code> so every caller shares the same locale and catalogs, exactly like{' '}
        <code>getStore</code> / <code>getEventBus</code>.
      </p>
      <CodeBlock
        language="ts"
        code={`import { getI18n, setI18n, createI18n } from '@jorvel/i18n';

// Host — configure ONCE before remotes load:
setI18n(createI18n({ locale: 'en', catalogs: { en: { greet: 'Hi, {name}' } } }));

// Anywhere (host or any remote) — same instance, same active locale:
const i18n = getI18n();
i18n.t('greet', { name: 'Ada' });
await i18n.setLocale('fr');   // every remote that subscribed re-renders`}
      />
      <Callout variant="info" title="First call wins">
        <code>getI18n(opts)</code> creates the instance from <code>opts</code> only on the first call
        (defaulting to <code>{`{ locale: 'en' }`}</code>); later calls ignore <code>opts</code> and
        return the existing instance. Configure it in the host before remotes mount, or replace it
        outright with <code>setI18n(instance)</code>.
      </Callout>

      <h2 id="grammar">Interpolation grammar</h2>
      <table>
        <thead><tr><th>Token</th><th>Use</th></tr></thead>
        <tbody>
          <tr><td><code>{'{name}'}</code></td><td>Substitute a value</td></tr>
          <tr><td><code>{'{count, plural, one {…} other {…}}'}</code></td><td>Plural arm via <code>Intl.PluralRules</code></td></tr>
          <tr><td><code>{'{count, plural, =0 {…} other {…}}'}</code></td><td>Exact match wins over category</td></tr>
          <tr><td><code>{'{n, number}'}</code></td><td>Locale-aware grouping (1,234,567)</td></tr>
          <tr><td><code>{'{n, number, percent}'}</code></td><td>Percent style</td></tr>
          <tr><td><code>#</code></td><td>Inside a plural arm, substitutes the numeric value</td></tr>
        </tbody>
      </table>

      <h2 id="missing">Missing keys</h2>
      <p>
        If a key is missing in the active locale, the runtime tries (in order): the base-language
        catalog (<code>en-US</code> → <code>en</code>), the fallback locale, and finally the key
        itself. The key fallback makes development obvious — you immediately see which strings need
        translation.
      </p>

      <h2 id="lazy">Lazy catalogs</h2>
      <p>
        Pass a <code>loader</code> to fetch a catalog on demand. The first call to{' '}
        <code>setLocale(x)</code> awaits the loader and caches the result. Subsequent locale swaps
        are synchronous.
      </p>
      <CodeBlock
        language="ts"
        code={`const i18n = createI18n({
  locale: 'en',
  catalogs: { en: { greet: 'Hi, {name}' } },
  loader: async (locale) => {
    const res = await fetch(\`/locales/\${locale}.json\`);
    return await res.json();
  },
});

await i18n.setLocale('ja');               // fetches /locales/ja.json
i18n.t('greet', { name: 'Ada' });`}
      />
      <Callout variant="info" title="setLocale is race-safe">
        Concurrent loads of the same locale are deduped onto a single in-flight promise, and{' '}
        <code>setLocale</code> applies the <strong>latest</strong> call&apos;s result — if an earlier
        locale&apos;s loader resolves after a later one, the stale result is discarded rather than
        clobbering the active locale.
      </Callout>

      <h2 id="ssr">SSR locale detection</h2>
      <p>
        <code>detectLocale(acceptLanguage, supported, fallback)</code> parses an{' '}
        <code>Accept-Language</code> header, respects <code>q</code> values, and prefers exact
        matches over base-language fallbacks. Pure function — safe on edge runtimes.
      </p>
      <CodeBlock
        language="ts"
        code={`import { detectLocale, createI18n } from '@jorvel/i18n';

export async function handler(req: Request): Promise<Response> {
  const accept = req.headers.get('accept-language') ?? undefined;
  const locale = detectLocale(accept, ['en', 'fr-CA', 'ja'], 'en');
  const i18n = createI18n({ locale, catalogs: await loadCatalogs(locale) });
  // …render with i18n.t(...)
}`}
      />

      <h2 id="hydration">Hydrating client from server</h2>
      <p>
        Serialize the active locale + catalog into the HTML, then re-create the i18n instance on
        the client. <code>serializeState</code> from <code>@jorvel/ssr</code> safely escapes the
        JSON for inline script injection.
      </p>
      <CodeBlock
        language="ts"
        filename="server"
        code={`import { serializeState } from '@jorvel/ssr';

const html = template
  .replace('</head>', \`
    <script id="__JORVEL_I18N__" type="application/json">\${serializeState({
      locale: i18n.locale,
      catalogs: i18n.catalogs,
    })}</script>
  </head>\`);`}
      />
      <CodeBlock
        language="ts"
        filename="client"
        code={`import { createI18n } from '@jorvel/i18n';

const raw = document.getElementById('__JORVEL_I18N__')?.textContent;
const hydrated = raw ? JSON.parse(raw) : undefined;

export const i18n = createI18n({
  locale: hydrated?.locale ?? 'en',
  catalogs: hydrated?.catalogs ?? {},
  fallbackLocale: 'en',
});`}
      />

      <h2 id="react">React adapter (BYO)</h2>
      <p>
        The package stays framework-agnostic. A tiny React adapter is one <code>useSyncExternalStore</code> away:
      </p>
      <CodeBlock
        language="tsx"
        code={`import { useSyncExternalStore } from 'react';
import { i18n } from './i18n';

export function useTranslation() {
  useSyncExternalStore(i18n.subscribe, () => i18n.locale, () => i18n.locale);
  return { t: i18n.t.bind(i18n), locale: i18n.locale, setLocale: i18n.setLocale.bind(i18n) };
}`}
      />

      <h2 id="i18n-shape">I18n interface</h2>
      <CodeBlock
        language="ts"
        code={`interface I18n {
  locale: string;
  t(key: string, values?: FormatValues): string;
  setLocale(locale: string): Promise<void>;
  subscribe(listener: () => void): () => void;
  load(locale: string): Promise<void>;       // load without switching
  catalogs: Catalog;
}`}
      />

      <h2 id="multi-locale">Multi-locale SSR</h2>
      <p>
        Generating the same page in N locales? Build one i18n per locale and run them in parallel —
        the runtime is stateless except for the catalogs object, so memory stays bounded.
      </p>
      <CodeBlock
        language="ts"
        code={`const renders = await Promise.all(
  ['en', 'fr', 'ja'].map(async (locale) => {
    const i18n = createI18n({ locale, catalogs: { [locale]: await loadCatalog(locale) } });
    return { locale, html: await renderRouteToString(App, { i18n, path: '/' }) };
  }),
);`}
      />

      <Callout variant="info" title="Subscribe + re-render">
        <code>i18n.subscribe(fn)</code> notifies you on every <code>setLocale</code> /{' '}
        <code>load</code>. Wrap it in a React/Vue/Svelte adapter to re-render the tree.
      </Callout>

      <h2 id="locale-routing">Locale-prefixed routes</h2>
      <p>
        Serve <code>/en/dashboard</code>, <code>/fr/dashboard</code> with the routing helpers.{' '}
        <code>extractLocale</code> splits the prefix, <code>localizePath</code> adds one,{' '}
        <code>stripLocale</code> removes it.
      </p>
      <CodeBlock
        language="ts"
        code={`import { extractLocale, localizePath, stripLocale } from '@jorvel/i18n';

const LOCALES = ['en', 'fr', 'ar'];
extractLocale('/fr/dashboard', LOCALES);          // { locale: 'fr', rest: '/dashboard' }
localizePath('/dashboard', 'fr', { locales: LOCALES }); // '/fr/dashboard'
stripLocale('/fr/dashboard', LOCALES);            // '/dashboard'`}
      />

      <h2 id="locale-detection">Detection middleware</h2>
      <p>
        <code>negotiateLocale</code> parses <code>Accept-Language</code> (with a cookie override);{' '}
        <code>localeMiddleware</code> returns a JORVEL <a href="/docs/middleware">middleware</a>{' '}
        decision that redirects unprefixed paths to the best locale.
      </p>
      <CodeBlock
        language="ts"
        filename="apps/shell/src/middleware.ts"
        code={`import { localeMiddleware } from '@jorvel/i18n';

export default localeMiddleware({ supported: ['en', 'fr', 'ar'], default: 'en' });
// GET /dashboard with Accept-Language: fr → 307 → /fr/dashboard`}
      />

      <h2 id="rtl">RTL layout</h2>
      <CodeBlock
        language="tsx"
        code={`import { htmlDirAttrs, isRtlLocale } from '@jorvel/i18n';

const { lang, dir } = htmlDirAttrs(locale);   // ar → { lang: 'ar', dir: 'rtl' }
// <html lang={lang} dir={dir}> — flips the whole document; use logical CSS props
// (margin-inline-start, etc.) so components mirror automatically.`}
      />

      <h2 id="icu">Full ICU MessageFormat</h2>
      <p><code>formatMessage</code> handles plural, number, and now <code>select</code>/gender + dates:</p>
      <CodeBlock
        language="ts"
        code={`formatMessage('{g, select, male {He} female {She} other {They}} liked this', { g: 'female' });
// → 'She liked this'
formatMessage('{n, plural, one {# item} other {# items}}', { n: 3 });      // '3 items'
formatMessage('Posted {when, date, medium}', { when: new Date() }, 'en');  // 'Posted Jan 15, 2026'`}
      />
    </>
  );
}
