import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { JorvelCliError } from '../errors.js';

type OutputFormat = 'webp' | 'avif';
const ALLOWED_FORMATS: OutputFormat[] = ['webp', 'avif'];

export type ImageOptimizeOptions = {
  dir: string;
  app?: string;
  dist?: string;
  outDir?: string;
  formats: OutputFormat[];
  widths: number[];
  quality: number;
  include: string[];
  dryRun: boolean;
};

export type ImageOptimizeJob = {
  inputFile: string;
  outputFile: string;
  format: OutputFormat;
  width: number;
  bytesBefore?: number;
  bytesAfter?: number;
};

function parseCsvList(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCsvNumbers(v: string): number[] {
  return parseCsvList(v).map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

async function listFilesRec(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string) {
    const entries = await fs.readdir(d);
    for (const e of entries) {
      const full = path.join(d, e);
      const st = await fs.stat(full);
      if (st.isDirectory()) await walk(full);
      else out.push(full);
    }
  }
  await walk(dir);
  return out;
}

export async function planImageOptimizations(opts: ImageOptimizeOptions): Promise<ImageOptimizeJob[]> {
  const workspaceDir = path.resolve(opts.dir);
  const distDir = opts.dist
    ? path.resolve(opts.dist)
    : opts.app
      ? path.join(workspaceDir, 'apps', opts.app, 'dist')
      : path.join(workspaceDir, 'dist');

  const outDir = opts.outDir ? path.resolve(opts.outDir) : distDir;
  const exists = await fs.pathExists(distDir);
  if (!exists) throw new Error(`dist directory not found: ${distDir}`);

  const files = await listFilesRec(distDir);
  const includeLower = opts.include.map((s) => s.toLowerCase());
  const inputs = files.filter((f) => includeLower.some((ext) => f.toLowerCase().endsWith(ext)));

  const jobs: ImageOptimizeJob[] = [];
  for (const inputFile of inputs) {
    const rel = path.relative(distDir, inputFile);
    const baseNoExt = rel.replace(/\.[^.]+$/, '');

    for (const width of opts.widths) {
      for (const format of opts.formats) {
        const outputRel = `${baseNoExt}.${width}w.${format}`;
        jobs.push({
          inputFile,
          outputFile: path.join(outDir, outputRel),
          format,
          width,
        });
      }
    }
  }

  return jobs;
}

export async function runImageOptimizations(opts: ImageOptimizeOptions): Promise<ImageOptimizeJob[]> {
  const jobs = await planImageOptimizations(opts);
  if (opts.dryRun) return jobs;

  // Lazy import so jorvel doesn't hard-require sharp unless the command is used.
  const { default: sharp } = await import('sharp');

  for (const job of jobs) {
    await fs.ensureDir(path.dirname(job.outputFile));

    const stBefore = await fs.stat(job.inputFile);
    job.bytesBefore = stBefore.size;

    const img = sharp(job.inputFile).resize({ width: job.width, withoutEnlargement: true });
    if (job.format === 'webp') {
      await img.webp({ quality: opts.quality }).toFile(job.outputFile);
    } else {
      await img.avif({ quality: opts.quality }).toFile(job.outputFile);
    }

    const stAfter = await fs.stat(job.outputFile);
    job.bytesAfter = stAfter.size;
  }

  return jobs;
}

export const imageCommand = new Command('image').description(
  'Image tooling (optimization, resizing, modern formats)'
);

imageCommand
  .command('optimize')
  .description('Generate optimized image variants from dist/ (webp/avif + responsive widths)')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--app <name>', 'App name under apps/<name> (optional)')
  .option('--dist <path>', 'Override dist directory (defaults to apps/<app>/dist when --app is set)')
  .option('--out <path>', 'Output directory (default: overwrite into dist/ alongside originals)')
  .option('--formats <list>', 'Comma-separated formats: webp,avif', 'webp,avif')
  .option('--widths <list>', 'Comma-separated widths in px', '320,640,960,1280')
  .option('--quality <n>', 'Quality (1-100)', '75')
  .option('--include <list>', 'Comma-separated extensions to include', '.png,.jpg,.jpeg')
  .option('--dry-run', 'Print planned outputs without writing files', false)
  .option('--format <format>', 'Output format: table|json', 'table')
  .action(async (raw: any) => {
    const opts: ImageOptimizeOptions = {
      dir: raw.dir,
      app: raw.app,
      dist: raw.dist,
      outDir: raw.out,
      formats: parseCsvList(raw.formats) as OutputFormat[],
      widths: parseCsvNumbers(raw.widths),
      quality: Number(raw.quality),
      include: parseCsvList(raw.include),
      dryRun: Boolean(raw.dryRun),
    };

    // Validate up front — unknown formats used to fall through silently.
    if (!Number.isFinite(opts.quality) || opts.quality < 1 || opts.quality > 100) {
      throw new JorvelCliError(`--quality must be an integer 1-100 (got "${raw.quality}").`, {
        code: 'IMG-001',
      });
    }
    const badFormats = opts.formats.filter((f) => !ALLOWED_FORMATS.includes(f));
    if (badFormats.length > 0) {
      throw new JorvelCliError(
        `Unknown --formats value(s): ${badFormats.join(', ')}. Allowed: ${ALLOWED_FORMATS.join(', ')}.`,
        { code: 'IMG-002' },
      );
    }

    const workspaceDir = path.resolve(opts.dir);
    const jobs = await runImageOptimizations(opts);

    if (raw.format === 'json') {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ jobs }, null, 2));
      return;
    }

    // eslint-disable-next-line no-console
    console.log(kleur.cyan(`Image optimize: ${path.relative(workspaceDir, path.resolve(opts.dist || 'dist'))}`));

    if (jobs.length === 0) {
      // eslint-disable-next-line no-console
      console.log(kleur.gray('No matching images found.'));
      return;
    }

    for (const j of jobs.slice(0, 50)) {
      const after = j.bytesAfter != null ? ` → ${j.bytesAfter} bytes` : '';
      // eslint-disable-next-line no-console
      console.log(`  ${kleur.green('✓')} ${path.basename(j.outputFile)} (${j.format}, ${j.width}w)${after}`);
    }
    if (jobs.length > 50) {
      // eslint-disable-next-line no-console
      console.log(kleur.gray(`  … and ${jobs.length - 50} more output(s)`));
    }

    if (opts.dryRun) {
      // eslint-disable-next-line no-console
      console.log(kleur.gray('Dry run: no files written.'));
    }
  });
