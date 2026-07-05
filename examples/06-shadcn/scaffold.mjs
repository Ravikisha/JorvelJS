#!/usr/bin/env node
/**
 * Generates this example as a REAL JORVEL app — real .tsx/.vue/.js source, not
 * .mjs. Runs the same CLI a developer runs. Pass a target dir as arg[2] (used by
 * the test); defaults to this folder.
 *
 *   node scaffold.mjs            # scaffold here -> apps/*, jorvel.federation.json
 *   pnpm scaffold                # same, builds the CLI first
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : here;
const cli = path.resolve(here, '..', '..', 'packages', 'cli', 'dist', 'index.js');
const g = (args) => { console.log('> jorvel', args.join(' ')); execFileSync(process.execPath, [cli, ...args, '--dir', target], { stdio: 'inherit' }); };

g(["generate","host","shell","--port","3000","--lang","ts","--tailwind","--remote","ui"]);
g(["generate","remote","ui","--port","3001","--framework","react","--lang","ts","--tailwind"]);
g(["federation"]);
console.log('');
console.log('OK React remote ready for shadcn/ui.');
console.log('  pnpm install   # from the repo root');
console.log('  jorvel dev     # host :3000 loads its remotes');
