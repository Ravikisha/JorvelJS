import { Callout } from '@/components/docs/callout';
import { ShowcaseGrid } from '@/components/docs/showcase-grid';

export const metadata = {
  title: 'Showcase',
  description: 'Runnable JORVEL starters — open each in StackBlitz, CodeSandbox, GitHub Codespaces, or clone & run locally.',
};

export default function Showcase() {
  return (
    <>
      <h1>Showcase</h1>
      <p>
        Runnable starters that ship in the repo. Open any of them in a browser sandbox — StackBlitz,
        CodeSandbox, or GitHub Codespaces — or grab the one-line clone-&amp;-run command.
      </p>

      <ShowcaseGrid />

      <h2 id="run">Running locally</h2>
      <p>
        Each card&apos;s <strong>Clone &amp; run</strong> copies a one-liner. The gist for the
        SSG/SSR examples:
      </p>
      <pre className="code-pre" style={{ background: 'hsl(240 10% 5%)', color: 'hsl(0 0% 90%)', padding: '1rem 1.25rem', borderRadius: '0.625rem', overflowX: 'auto' }}>
{`git clone https://github.com/Ravikisha/JorvelJS
cd JorvelJS && pnpm install
cd examples/02-react
pnpm build             # renders dist-ssg/
pnpm start             # serve the static output`}
      </pre>
      <p>
        The <code>03-polyglot</code> example runs live cross-framework federation instead:{' '}
        <code>cd examples/03-polyglot &amp;&amp; pnpm scaffold &amp;&amp; jorvel dev</code> (React host
        on :3000 mounts React, Vue &amp; Angular remotes).
      </p>

      <h2 id="submit">Submit your app</h2>
      <p>
        Shipping something on JORVEL? Open a{' '}
        <a href="https://github.com/Ravikisha/JorvelJS/discussions">Discussion</a> with a screenshot
        + link and we&apos;ll feature it here.
      </p>

      <Callout variant="info" title="Browser sandboxes">
        StackBlitz &amp; CodeSandbox boot the repo in-browser (no install). Codespaces spins up a
        full cloud dev container. All three open the exact <code>examples/&lt;name&gt;</code> folder.
      </Callout>
    </>
  );
}
