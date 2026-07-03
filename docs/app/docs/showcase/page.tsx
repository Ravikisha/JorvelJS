import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Showcase',
  description: 'Apps and starters built with JORVEL. Submit yours.',
};

const EXAMPLES = [
  { name: 'basic', desc: 'Host + dashboard remote — the canonical two-tier setup.', path: 'examples/basic' },
  { name: 'ecommerce', desc: 'Storefront + cart + checkout as independent remotes.', path: 'examples/ecommerce' },
  { name: 'saas', desc: 'Marketing site + authed dashboard, split by team.', path: 'examples/saas' },
];

export default function Showcase() {
  return (
    <>
      <h1>Showcase</h1>
      <p>Real JORVEL apps and the starters that ship in the repo.</p>

      <h2 id="starters">In-repo starters</h2>
      <ul>
        {EXAMPLES.map((e) => (
          <li key={e.name}>
            <a href={`https://github.com/Ravikisha/JorvelJS/tree/main/${e.path}`}>
              <strong>{e.name}</strong>
            </a>{' '}
            — {e.desc}
          </li>
        ))}
      </ul>

      <h2 id="submit">Submit your app</h2>
      <p>
        Shipping something on JORVEL? Open a{' '}
        <a href="https://github.com/Ravikisha/JorvelJS/discussions">Discussion</a> with a screenshot
        + link and we&apos;ll add it here.
      </p>

      <Callout variant="info" title="Try it live">
        Every starter opens in a browser sandbox — see the{' '}
        <a href="/docs/getting-started#sandbox">StackBlitz links</a> on Getting started.
      </Callout>
    </>
  );
}
