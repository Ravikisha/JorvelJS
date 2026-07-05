import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'AI coding tools',
  description:
    'jorvel init scaffolds config for Claude Code, Codex, Cursor, Copilot, Windsurf and Gemini — plus a Model Context Protocol server that gives any MCP client live access to the JORVEL docs.',
};

export default function AiTools() {
  return (
    <>
      <h1>AI coding tools</h1>
      <p>
        <code>jorvel init</code> can scaffold ready-made config for the AI coding tools you use, so
        an assistant understands JORVEL&apos;s two-tier router, the shared-singleton federation
        boundary, and the CLI verbs from the first prompt — no cold start. It also wires a{' '}
        <strong>Model Context Protocol</strong> server that serves the live docs to any MCP client.
      </p>

      <h2 id="choose">Choosing tools at init</h2>
      <p>
        In an interactive terminal, <code>jorvel init</code> asks which tools to generate support
        for (all pre-checked). Non-interactively it generates all of them. Drive it with flags:
      </p>
      <CodeBlock
        language="bash"
        code={`jorvel init my-app                       # interactive checkbox — pick tools
jorvel init my-app --ai claude,cursor,mcp  # only these
jorvel init my-app --no-ai               # skip all AI config
jorvel init my-app --yes                 # non-interactive → all tools`}
      />
      <p>
        Valid <code>--ai</code> values: <code>claude</code>, <code>codex</code>, <code>cursor</code>
        , <code>copilot</code>, <code>windsurf</code>, <code>gemini</code>, <code>mcp</code>.
      </p>

      <h2 id="files">What each tool gets</h2>
      <table>
        <thead>
          <tr><th>Tool</th><th>Files</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Claude Code</td>
            <td>
              <code>CLAUDE.md</code> + <code>.claude/</code> (<code>settings.json</code>,{' '}
              <code>skills/*.md</code>, <code>agents/*.md</code>, <code>README.md</code>)
            </td>
          </tr>
          <tr><td>Codex / Aider / Continue</td><td><code>AGENTS.md</code> (provider-neutral)</td></tr>
          <tr><td>Cursor</td><td><code>.cursorrules</code> + <code>AGENTS.md</code></td></tr>
          <tr><td>GitHub Copilot</td><td><code>.github/copilot-instructions.md</code></td></tr>
          <tr><td>Windsurf</td><td><code>.windsurfrules</code> + <code>AGENTS.md</code></td></tr>
          <tr><td>Gemini CLI</td><td><code>GEMINI.md</code> + <code>AGENTS.md</code></td></tr>
          <tr><td>MCP (any client)</td><td><code>.mcp.json</code></td></tr>
        </tbody>
      </table>
      <Callout variant="info" title="AGENTS.md is the shared base">
        Codex, Cursor, Windsurf, and Gemini all read the provider-neutral <code>AGENTS.md</code>;
        their tool-specific file just points to it. Selecting any of them writes it once.
      </Callout>

      <h2 id="claude-skills">Claude Code skills &amp; agents</h2>
      <p>The <code>.claude/</code> scaffold ships invokable skills and subagent definitions:</p>
      <table>
        <thead><tr><th>Type</th><th>Included</th></tr></thead>
        <tbody>
          <tr>
            <td>Skills (<code>/name</code>)</td>
            <td>
              <code>federation-contracts</code>, <code>file-routing</code>, <code>ssr</code>,{' '}
              <code>security</code>, <code>testing</code>, <code>jorvel-cli</code>
            </td>
          </tr>
          <tr>
            <td>Agents</td>
            <td>
              <code>host-builder</code>, <code>remote-builder</code>,{' '}
              <code>federation-auditor</code>, <code>security-reviewer</code>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <code>settings.json</code> pre-allows <code>Bash(pnpm:*)</code> and{' '}
        <code>Bash(jorvel:*)</code> and denies reading <code>.env</code>, so the agent is productive
        without prompting on every command and can&apos;t leak secrets.
      </p>

      <h2 id="mcp">The docs MCP server</h2>
      <p>
        <code>@jorvel/mcp-docs</code> is a Model Context Protocol server that exposes the JORVEL docs
        to any MCP client. When <code>mcp</code> is selected, init writes <code>.mcp.json</code>:
      </p>
      <CodeBlock
        language="json"
        filename=".mcp.json"
        code={`{
  "mcpServers": {
    "jorvel-docs": { "command": "npx", "args": ["-y", "@jorvel/mcp-docs"] }
  }
}`}
      />
      <p>
        Claude Code reads <code>.mcp.json</code> at the project root automatically. For Cursor or
        Windsurf, add the same entry in their MCP settings. It exposes three tools:
      </p>
      <table>
        <thead><tr><th>Tool</th><th>Args</th><th>Returns</th></tr></thead>
        <tbody>
          <tr><td><code>list_docs</code></td><td>—</td><td>Every doc page (section, title, URL).</td></tr>
          <tr><td><code>search_docs</code></td><td><code>query</code></td><td>The most relevant pages for a query.</td></tr>
          <tr><td><code>get_doc</code></td><td><code>path</code></td><td>A page as plain text (URL or <code>/docs/…</code>).</td></tr>
        </tbody>
      </table>
      <p>
        Point it at a self-hosted docs deployment with the <code>JORVEL_DOCS_BASE</code> environment
        variable (defaults to the public site). Run it standalone to sanity-check:
      </p>
      <CodeBlock language="bash" code={`npx -y @jorvel/mcp-docs   # speaks MCP over stdio`} />

      <Callout variant="success" title="Regenerate any time">
        These files are plain scaffolding — safe to edit, commit, and tune per team. Re-run{' '}
        <code>jorvel init</code> in a fresh directory to regenerate a clean set to diff against.
      </Callout>
    </>
  );
}
