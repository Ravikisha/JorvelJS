import { Command } from 'commander';
import { execa } from 'execa';
import kleur from 'kleur';

export const lintCommand = new Command('lint')
  .description('Run eslint across the workspace.')
  .option('--fix', 'Autofix issues')
  .action(async (opts: { fix?: boolean }) => {
    const args = ['-r', '--if-present', 'lint'];
    if (opts.fix) args.push('--', '--fix');
    try {
      await execa('pnpm', args, { stdio: 'inherit' });
    } catch (err) {
      console.error(kleur.red('lint failed'));
      process.exit(1);
    }
  });
