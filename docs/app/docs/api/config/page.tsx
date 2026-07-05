import { CodeBlock } from '@/components/site/code-block';

export const metadata = {
  title: 'Shared configs API',
  description: 'ESLint, Prettier, and TypeScript presets — @jorvel/eslint-config, @jorvel/prettier-config, @jorvel/tsconfig.',
};

export default function ConfigApi() {
  return (
    <>
      <h1>Shared configs</h1>
      <p>The presets `jorvel init` wires up. Extend them directly in your own workspace.</p>

      <h2 id="eslint">@jorvel/eslint-config</h2>
      <p>ESLint 9 flat config. TS rules apply only to <code>*.ts,tsx</code>; plain JS gets a leaner set.</p>
      <CodeBlock
        language="js"
        filename="eslint.config.mjs"
        code={`import jorvel from '@jorvel/eslint-config';

export default [
  ...jorvel,
  { ignores: ['**/dist/**', '**/.turbo/**', '**/coverage/**'] },
];`}
      />

      <h2 id="prettier">@jorvel/prettier-config</h2>
      <CodeBlock
        language="json"
        filename="package.json"
        code={`{ "prettier": "@jorvel/prettier-config" }`}
      />

      <h2 id="tsconfig">@jorvel/tsconfig</h2>
      <p>Strict presets (base + React DOM). The workspace <code>tsconfig.base.json</code> enables <code>strict</code>, <code>noUncheckedIndexedAccess</code>, <code>exactOptionalPropertyTypes</code>.</p>
      <CodeBlock
        language="json"
        filename="tsconfig.json"
        code={`{
  "extends": "@jorvel/tsconfig/react.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src"]
}`}
      />
    </>
  );
}
