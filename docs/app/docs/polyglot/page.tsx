import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Polyglot monorepo',
  description:
    'Build React, Vue, Solid, Svelte and Angular micro-frontends in one repo and run them in a single host app — jorvel generate remote --framework <fw> scaffolds each with its own template + AI skills.',
};

export default function Polyglot() {
  return (
    <>
      <h1>Polyglot monorepo</h1>
      <p>
        A JORVEL workspace can hold micro-frontends built with <strong>different frameworks</strong>{' '}
        — a React app, a Vue app, an Angular app — all federated into a{' '}
        <strong>single host</strong>. Each remote is embedded through the framework-neutral{' '}
        <a href="/docs/cross-framework">mount contract</a>, so the host never imports a remote&apos;s
        framework. This is the real micro-frontend experience: independent teams, independent stacks,
        one running app.
      </p>

      <Callout variant="info" title="Host is React; remotes are anything">
        The host owns the two-tier router and shell, so it&apos;s always React. Remotes are where the
        polyglot freedom lives — pick a framework per remote.
      </Callout>

      <h2 id="generate">Generate apps by framework</h2>
      <p>
        <code>jorvel generate remote</code> asks which framework to use (in a TTY), or take it
        non-interactively with <code>--framework</code>:
      </p>
      <CodeBlock
        language="bash"
        code={`jorvel generate host shell                              # React host
jorvel generate remote dashboard --framework react     # React remote
jorvel generate remote pricing   --framework vue       # Vue 3 remote
jorvel generate remote reports   --framework angular   # Angular remote
jorvel generate remote widgets   --framework solid     # SolidJS remote
jorvel generate remote docs      --framework svelte    # Svelte 5 remote

jorvel federation      # wire every remote into the host
jorvel dev             # run the whole thing`}
      />
      <p>
        Supported: <code>react</code>, <code>vue</code>, <code>solid</code>, <code>svelte</code>,{' '}
        <code>angular</code>. The interactive <code>jorvel generate wizard</code> asks per remote too.
      </p>
      <Callout variant="info" title="Tailwind, per app">
        Each <code>generate host</code>/<code>generate remote</code> also prompts{' '}
        <em>&quot;Add Tailwind CSS?&quot;</em> (skip with <code>--tailwind</code> /{' '}
        <code>--no-tailwind</code>). Tailwind works for <strong>every</strong> framework — the
        scaffold wires PostCSS through rspack with a framework-correct <code>content</code> glob, so
        one remote can use Tailwind while another doesn&apos;t.
      </Callout>

      <h2 id="what">What each remote gets</h2>
      <table>
        <thead>
          <tr><th>Framework</th><th>Exposed <code>./App</code></th><th>Adapter</th></tr>
        </thead>
        <tbody>
          <tr><td>React</td><td><code>defineReactRemote(Root)</code></td><td><code>@jorvel/adapter-react</code></td></tr>
          <tr><td>Vue 3</td><td><code>defineVueRemote(Root)</code></td><td><code>@jorvel/adapter-vue</code></td></tr>
          <tr><td>SolidJS</td><td><code>defineSolidRemote(Root)</code></td><td><code>@jorvel/adapter-solid</code></td></tr>
          <tr><td>Svelte 5</td><td><code>defineSvelteRemote(Root)</code></td><td><code>@jorvel/adapter-svelte</code></td></tr>
          <tr><td>Angular</td><td><code>defineAngularRemote(RootComponent)</code></td><td><code>@jorvel/adapter-angular</code></td></tr>
        </tbody>
      </table>
      <p>
        Each scaffold ships a framework-appropriate <code>rspack.config.mjs</code> (correct loaders +
        Module Federation), a sample root component, a standalone dev entry that mounts the remote
        through the same contract the host uses, and <code>jorvel.app.json</code> marked with its{' '}
        <code>framework</code>.
      </p>

      <h2 id="skills">Per-app + global AI skills</h2>
      <p>
        Every generated remote also gets a framework-specific skill at{' '}
        <code>apps/&lt;name&gt;/.claude/skills/&lt;fw&gt;-remote.md</code> — so a coding agent working
        in that app knows its conventions (Vue SFC + <code>vue-loader</code>, Angular standalone +
        JIT, Solid JSX via babel, …). The workspace-wide{' '}
        <code>.claude/skills/mount-contract.md</code> (from <code>jorvel init</code>) covers the
        cross-framework rules that apply everywhere.
      </p>
      <CodeBlock
        language="text"
        code={`my-app/
├── .claude/skills/mount-contract.md        # global — cross-framework rules
└── apps/
    ├── shell/          (react host)
    ├── dashboard/      .claude/skills/react-remote.md
    ├── pricing/        .claude/skills/vue-remote.md
    └── reports/        .claude/skills/angular-remote.md`}
      />

      <h2 id="federation">Federation is framework-aware</h2>
      <p>
        <code>jorvel federation</code> shares each app&apos;s <em>own</em> framework runtime as a
        singleton — the React host + React remotes share <code>react</code>/<code>react-dom</code>; a
        Vue remote shares <code>vue</code>; an Angular remote shares <code>@angular/*</code>. The{' '}
        <code>@jorvel/event-bus</code> is shared across <em>all</em> apps as the neutral cross-app
        channel. A Vue remote never has React forced into its scope.
      </p>

      <h2 id="communicate">Talking between frameworks</h2>
      <p>
        There&apos;s no shared framework context across the boundary. Use the framework-neutral
        channels — the event bus or DOM <code>CustomEvent</code>s:
      </p>
      <CodeBlock
        language="ts"
        code={`// Any remote, any framework
import { createEventBus } from '@jorvel/event-bus';
const bus = createEventBus();
bus.emit('cart:add', { sku: 'A1', qty: 2 });   // Vue remote
bus.on('cart:add', (p) => { /* … */ });          // React host reacts`}
      />

      <Callout variant="warn" title="Cost of going polyglot">
        Mixing frameworks means each ships its own runtime — a heavier baseline than an all-React
        workspace. Non-React scaffolds are an experimental starting point: the mount contract is
        stable, the build config is yours to tune. Reach for polyglot when you genuinely have
        mixed-stack teams; otherwise stay single-framework.
      </Callout>
    </>
  );
}
