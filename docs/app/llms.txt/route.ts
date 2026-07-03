/**
 * `/llms.txt` — discovery file for LLM-driven IDE agents.
 *
 * Convention: https://llmstxt.org/. Lists every authoritative docs URL so an
 * agent can fetch the docs corpus without crawling the site. The content is
 * generated from `app/docs/nav.ts` (single source of truth).
 */
import { DOC_NAV } from '../docs/nav';

const SITE_URL = 'https://jorveljs.vercel.app';

export const dynamic = 'force-static';

export function GET(): Response {
  const lines: string[] = [];
  lines.push('# JORVEL');
  lines.push('');
  lines.push(
    '> Production-grade micro-frontend framework on top of Rspack Module Federation. Typed federation contracts, file-based routing, SSR + streaming + SSG, edge adapters, observability, security primitives, and a CLI that scaffolds everything.',
  );
  lines.push('');
  lines.push('Docs base: ' + SITE_URL);
  lines.push('GitHub: https://github.com/Ravikisha/JorvelJS');
  lines.push('npm: https://www.npmjs.com/package/jorvel');
  lines.push('');
  for (const section of DOC_NAV) {
    lines.push(`## ${section.title}`);
    lines.push('');
    for (const link of section.links) {
      lines.push(`- [${link.label}](${SITE_URL}${link.href})`);
    }
    lines.push('');
  }
  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
