import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Testing',
  description:
    'Every generated app ships Vitest + React Testing Library with a real render test — not expect(1+1). Plus federation contract tests.',
};

export default function Testing() {
  return (
    <>
      <h1>Testing</h1>
      <p>
        Generated apps come test-ready: <strong>Vitest</strong> (jsdom) +{' '}
        <strong>React Testing Library</strong> + <strong>jest-dom</strong> matchers, wired with a
        real example test that renders the home page and asserts on the DOM — not a placeholder{' '}
        <code>expect(1 + 1)</code>. <code>pnpm test</code> passes on a fresh scaffold.
      </p>

      <h2 id="whats-generated">What gets scaffolded</h2>
      <table>
        <thead><tr><th>File</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>vitest.config.ts</code></td><td>jsdom env, globals, coverage (v8), <code>setupFiles</code></td></tr>
          <tr><td><code>vitest.setup.ts</code></td><td>Registers jest-dom matchers + auto-<code>cleanup()</code> between tests</td></tr>
          <tr><td><code>src/pages/index.test.tsx</code></td><td>A working RTL render test to copy from</td></tr>
        </tbody>
      </table>
      <CodeBlock
        language="tsx"
        filename="src/pages/index.test.tsx"
        code={`import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from './index.js';

describe('dashboard — HomePage', () => {
  it('renders the home heading', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /home/i })).toBeInTheDocument();
  });
});`}
      />

      <h2 id="setup">The setup file</h2>
      <CodeBlock
        language="ts"
        filename="vitest.setup.ts"
        code={`import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});`}
      />
      <p>
        <code>@testing-library/jest-dom/vitest</code> adds matchers like{' '}
        <code>toBeInTheDocument()</code> / <code>toHaveTextContent()</code>;{' '}
        <code>@testing-library/user-event</code> is installed for realistic interaction tests.
      </p>

      <h2 id="run">Running tests</h2>
      <CodeBlock
        language="bash"
        code={`pnpm test            # vitest run (one app, or -r across the workspace)\npnpm test:watch      # watch mode\npnpm test:coverage   # v8 coverage → text + html + lcov\npnpm test:ui         # @vitest/ui`}
      />

      <Callout variant="info" title="Federation contract tests">
        Unit tests cover your components; <strong>contract tests</strong> verify a remote still
        exposes what a host imports. See <a href="/docs/federation">Module Federation → Contract
        tests</a> and gate PRs with <a href="/docs/cli"><code>jorvel federation diff</code></a>.
      </Callout>

      <Callout variant="warn" title="Test the page, not the framework">
        Assert on rendered output and user-visible behavior (roles, text), not on JORVEL internals.
        Query by role/label so tests survive refactors and stay accessible-by-default.
      </Callout>

      <h2 id="storybook">Storybook</h2>
      <p>
        Scaffold Storybook 8 (Rsbuild builder) into an app — config, a sample component + story, and
        <code> storybook</code> / <code>build-storybook</code> scripts:
      </p>
      <CodeBlock
        language="bash"
        code={`jorvel generate storybook            # into the host\njorvel generate storybook dashboard  # into a specific app\npnpm --filter ./apps/shell storybook`}
      />

      <h2 id="component-testing">Playwright Component Testing</h2>
      <p>
        For real-browser component tests (CSS, layout, focus) beyond jsdom, use Playwright CT. It
        renders components in a real Chromium/WebKit/Firefox.
      </p>
      <CodeBlock
        language="bash"
        code={`pnpm create playwright@latest --ct        # scaffolds playwright/index.html + playwright-ct.config.ts`}
      />
      <CodeBlock
        language="tsx"
        filename="src/components/Button.ct.spec.tsx"
        code={`import { test, expect } from '@playwright/experimental-ct-react';
import { Button } from './Button.js';

test('renders + clicks', async ({ mount }) => {
  let clicked = false;
  const cmp = await mount(<Button label="Go" onClick={() => (clicked = true)} />);
  await cmp.click();
  expect(clicked).toBe(true);
});`}
      />

      <h2 id="ci">Contract tests + bundle size in CI</h2>
      <p>
        <code>jorvel init</code> scaffolds two PR workflows: <code>contract-tests.yml</code> (runs{' '}
        <code>jorvel federation diff --base origin/&lt;base&gt;</code> + package tests, failing on a
        breaking contract change) and <code>bundle-size.yml</code> (comments compressed-size deltas
        for <code>remoteEntry</code> + chunks on the PR).
      </p>
    </>
  );
}
