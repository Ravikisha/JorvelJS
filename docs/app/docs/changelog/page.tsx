import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Changelog',
  description: 'How JORVEL versions release, and where to read per-package changelogs.',
};

export default function Changelog() {
  return (
    <>
      <h1>Changelog</h1>
      <p>
        JORVEL uses <a href="https://github.com/changesets/changesets">Changesets</a>. Every change
        adds a changeset; the release workflow (<code>.github/workflows/release.yml</code>, scaffolded
        at init) opens a version PR and, on merge, bumps versions + publishes + writes per-package{' '}
        <code>CHANGELOG.md</code>.
      </p>

      <h2 id="workflow">The flow</h2>
      <CodeBlock
        language="bash"
        code={`pnpm changeset            # describe the change + pick bump (patch/minor/major)
pnpm version              # apply bumps + regenerate CHANGELOG.md (usually done by CI)
pnpm release              # publish to npm (CI, on merge to main)`}
      />

      <h2 id="where">Where to read it</h2>
      <ul>
        <li>Per-package: <code>libs/&lt;pkg&gt;/CHANGELOG.md</code> and <code>packages/cli/CHANGELOG.md</code>.</li>
        <li>Releases: <a href="https://github.com/Ravikisha/JorvelJS/releases">GitHub Releases</a>.</li>
        <li>Roadmap of what&apos;s next: <a href="/docs/roadmap">/docs/roadmap</a>.</li>
      </ul>

      <Callout variant="info" title="Semver + contracts">
        Breaking federation-contract changes surface in CI via{' '}
        <a href="/docs/cli"><code>jorvel federation diff</code></a> before they merge — so a major
        bump is a deliberate, visible act, not a surprise.
      </Callout>
    </>
  );
}
