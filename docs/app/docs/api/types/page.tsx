import { CodeBlock } from '@/components/site/code-block';

export const metadata = {
  title: '@jorvel/types API',
  description: 'Federation contract DSL, config types, redirect/rewrite matchers, contract-test helpers, and JSON Schemas.',
};

export default function TypesApi() {
  return (
    <>
      <h1>@jorvel/types</h1>
      <p>
        Zero-runtime-ish shared types + a small set of pure helpers. The canonical source of
        <code> RouteTarget</code>, the federation contract DSL, workspace/app config shapes, and the
        JSON Schemas the CLI validates against.
      </p>

      <h2 id="contracts">Federation contracts</h2>
      <CodeBlock
        language="ts"
        code={`import { defineFederationContract, type InferExposed, type InferEmits } from '@jorvel/types';

export const contract = defineFederationContract({
  name: 'dashboard',
  exposes: { './App': null as unknown as import('./App').default },
  events: { emits: ['dashboard:action'] as const, listens: ['shell:ready'] as const },
});

type App = InferExposed<typeof contract, './App'>;   // the module's default-export type
type Emitted = InferEmits<typeof contract>;           // 'dashboard:action'
type Heard = InferListens<typeof contract>;           // 'shell:ready'

// runtime validation (awaits container.get per exposed key)
validateFederationContract(contract, container): Promise<ContractViolation[]>;
validateFederationContractKeys(contract, container): ContractViolation[];`}
      />

      <h2 id="config">Config types</h2>
      <CodeBlock
        language="ts"
        code={`type JorvelWorkspaceConfig = {         // jorvel.config.json
  name: string; appsDir?: string; libsDir?: string;
  features?: { tailwind?: boolean; reactCompiler?: boolean; template?: string };
  orchestrator?: { mode?: 'parallel' | 'on-demand'; proxyRemotes?: boolean; hmrRemotes?: boolean };
  federation?: { shared?: string[]; sri?: { algo?: string }; publicPath?: string; versionCheck?: boolean };
  security?: { csp?: { enabled?: boolean; reportUri?: string } };
  deploy?: { target?: string };
  plugins?: unknown[];
};
type JorvelAppConfig = { name: string; type: 'host' | 'remote'; port: number; /* … */ };
type RouteTarget = { path: string; remote: string; module?: string };  // matches @jorvel/runtime`}
      />

      <h2 id="redirects">Redirects &amp; rewrites</h2>
      <CodeBlock
        language="ts"
        code={`import { matchRedirect, matchRewrite } from '@jorvel/types';

matchRedirect([{ source: '/old/:slug', destination: '/new/:slug', permanent: true }], '/old/x');
// → { destination: '/new/x', status: 308 }
matchRewrite([{ source: '/api/*', destination: '/proxy/*' }], '/api/users'); // → '/proxy/users'`}
      />

      <h2 id="contract-tests">Contract-test helpers</h2>
      <CodeBlock
        language="ts"
        code={`// @jorvel/types/testing
contractChecks(contract, loadContainer): ContractCheck[];   // ready-to-run test cases
assertContract(contract, container): Promise<void>;         // throws on violation
generateContractTestSource(opts): string;                    // scaffold a spec file`}
      />

      <h2 id="schemas">JSON Schemas</h2>
      <p>
        Draft 2020-12 schemas for <code>jorvel.config</code> / <code>jorvel.app</code> /{' '}
        <code>jorvel.federation</code>, exposed as package subpaths so editors autocomplete:
      </p>
      <CodeBlock
        language="json"
        code={`{ "$schema": "./node_modules/@jorvel/types/schemas/jorvel.config.json" }`}
      />
      <p>
        <code>jorvel schema</code> re-emits them; <code>jorvel config validate</code> checks a
        workspace against the bundled schema.
      </p>
    </>
  );
}
