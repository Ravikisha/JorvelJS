#!/usr/bin/env node
/**
 * @jorvel/mcp-docs — Model Context Protocol server exposing the JORVEL docs to
 * any MCP client (Claude Code, Cursor, Windsurf, …).
 *
 * Tools:
 *   list_docs           — every doc page (section, label, url)
 *   search_docs(query)  — rank pages by a query
 *   get_doc(pathOrUrl)  — fetch a page as plain text
 *
 * Config the docs base with JORVEL_DOCS_BASE (defaults to the public site).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DEFAULT_DOCS_BASE, listDocs, searchDocs, getDoc } from './docs.js';

const base = process.env['JORVEL_DOCS_BASE'] ?? DEFAULT_DOCS_BASE;

const server = new McpServer({ name: 'jorvel-docs', version: '0.3.0' });

server.tool(
  'list_docs',
  'List every JORVEL documentation page (section, title, URL).',
  {},
  async () => {
    const links = await listDocs({ base });
    const text = links.map((l) => `- [${l.section}] ${l.label} — ${l.url}`).join('\n');
    return { content: [{ type: 'text', text: text || 'No docs found.' }] };
  },
);

server.tool(
  'search_docs',
  'Search the JORVEL docs by keyword; returns the most relevant pages.',
  { query: z.string().describe('Search terms, e.g. "middleware auth" or "deploy cloudflare"') },
  async ({ query }) => {
    const links = await listDocs({ base });
    const hits = searchDocs(query, links);
    const text = hits.length
      ? hits.map((l) => `- ${l.label} (${l.section}) — ${l.url}`).join('\n')
      : `No matches for "${query}".`;
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'get_doc',
  'Fetch a JORVEL doc page as plain text. Accepts a full URL or a /docs/... path.',
  { path: z.string().describe('A doc URL or path, e.g. "/docs/middleware"') },
  async ({ path }) => {
    const text = await getDoc(path, { base });
    return { content: [{ type: 'text', text }] };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe (stdout is the MCP channel).
  process.stderr.write(`[jorvel-mcp-docs] ready (docs base: ${base})\n`);
}

main().catch((err) => {
  process.stderr.write(`[jorvel-mcp-docs] fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
