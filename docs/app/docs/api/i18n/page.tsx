import { CodeBlock } from '@/components/site/code-block';

export const metadata = {
  title: '@jorvel/i18n API',
  description: 'Catalogs, formatMessage (ICU), locale routing, detection middleware, RTL, React bindings.',
};

export default function I18nApi() {
  return (
    <>
      <h1>@jorvel/i18n</h1>
      <p>ICU-capable i18n primitives — framework-agnostic core + React bindings at <code>@jorvel/i18n/react</code>.</p>

      <h2 id="core">Core</h2>
      <CodeBlock
        language="ts"
        code={`createI18n({ locale, catalogs?, fallbackLocale? }): I18n;   // t(), setLocale, load, subscribe
getI18n(opts?): I18n;  setI18n(instance): void;
formatMessage(template, values?, locale?): string;         // {name} {n, plural} {n, number} {g, select} {d, date}
detectLocale(accept, supported, fallback): string;          // Accept-Language (positional)`}
      />

      <h2 id="routing">Locale routing</h2>
      <CodeBlock
        language="ts"
        code={`extractLocale(pathname, locales, opts?): { locale: string | null; rest: string };
localizePath(pathname, locale, opts?): string;   // '/dashboard' → '/fr/dashboard'
stripLocale(pathname, locales, opts?): string;
buildLocaleHref(...): string;`}
      />

      <h2 id="detection">Detection + middleware</h2>
      <CodeBlock
        language="ts"
        code={`negotiateLocale({ supported, default, header?, cookie? }): string;
localeMiddleware({ supported, default, cookieName?, redirectStatus? }):
  (ctx) => { type: 'next' } | { type: 'redirect'; to; status };`}
      />

      <h2 id="rtl">RTL</h2>
      <CodeBlock
        language="ts"
        code={`isRtlLocale(locale): boolean;  dirForLocale(locale): 'rtl' | 'ltr';
htmlDirAttrs(locale): { lang: string; dir: 'rtl' | 'ltr' };`}
      />

      <h2 id="react">React (@jorvel/i18n/react)</h2>
      <CodeBlock
        language="ts"
        code={`<I18nProvider i18n={...}>; useI18n(); useT(); useLocale(); <Trans id values />`}
      />
    </>
  );
}
