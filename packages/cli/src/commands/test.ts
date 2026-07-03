import { Command } from 'commander';
import { execa } from 'execa';
import kleur from 'kleur';

export const testCommand = new Command('test')
  .description('Run vitest across the workspace.')
  .option('--coverage', 'Emit coverage reports')
  .option('--watch', 'Watch mode')
  .action(async (opts: { coverage?: boolean; watch?: boolean }) => {
    if (opts.watch) {
      // Run each package's own `test:watch` script (generated apps define it);
      // --if-present skips packages without one rather than erroring.
      await execa('pnpm', ['-r', '--parallel', '--if-present', 'test:watch'], { stdio: 'inherit' });
      return;
    }
    const script = opts.coverage ? 'test:coverage' : 'test';
    try {
      await execa('pnpm', ['-r', '--if-present', script], { stdio: 'inherit' });
    } catch {
      console.error(kleur.red('tests failed'));
      process.exit(1);
    }
  });
