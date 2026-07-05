# @jorvel/mcp-docs

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives
any MCP client (Claude Code, Cursor, Windsurf, …) live access to the JORVEL
documentation.

## Tools

| Tool | Args | Returns |
| --- | --- | --- |
| `list_docs` | — | Every doc page (section, title, URL). |
| `search_docs` | `query` | The most relevant pages for a query. |
| `get_doc` | `path` | A doc page as plain text (URL or `/docs/...`). |

## Use it

`jorvel init` writes a `.mcp.json` for you. To wire it manually:

```json
{
  "mcpServers": {
    "jorvel-docs": { "command": "npx", "args": ["-y", "@jorvel/mcp-docs"] }
  }
}
```

- **Claude Code** reads `.mcp.json` at the project root automatically.
- **Cursor / Windsurf** — add the same entry in their MCP settings.

Point it at a different docs deployment with `JORVEL_DOCS_BASE`
(defaults to `https://jorveljs.vercel.app`).

## Run standalone

```sh
npx -y @jorvel/mcp-docs      # speaks MCP over stdio
```
