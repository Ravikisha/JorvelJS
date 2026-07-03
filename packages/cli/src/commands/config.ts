import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { validateWorkspaceConfig } from '../config-schema.js';
import { JorvelCliError } from '../errors.js';

const CONFIG_FILES = ['jorvel.config.json', 'jorvel.config.mjs', 'jorvel.config.js'];

const configValidateCommand = new Command('validate')
  .description('Validate jorvel.config.json against the bundled JSON schema.')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .action(async (opts: { dir: string }) => {
    const workspaceDir = path.resolve(opts.dir);

    // Only the JSON form can be validated structurally; .mjs/.js may compute
    // values at runtime. Report which file we checked.
    const jsonPath = path.join(workspaceDir, 'jorvel.config.json');
    if (!(await fs.pathExists(jsonPath))) {
      const other = CONFIG_FILES.slice(1).find((f) => fs.pathExistsSync(path.join(workspaceDir, f)));
      if (other) {
        console.log(kleur.yellow(`Found ${other} (not JSON) — skipping schema validation.`));
        return;
      }
      throw new JorvelCliError(`No jorvel.config.json found in ${workspaceDir}.`, {
        code: 'CONFIG-004',
        hint: 'Run `jorvel init` or create a jorvel.config.json.',
      });
    }

    let parsed: unknown;
    try {
      parsed = await fs.readJson(jsonPath);
    } catch (err) {
      throw new JorvelCliError(`Failed to parse jorvel.config.json: ${(err as Error).message}`, {
        code: 'CONFIG-001',
      });
    }

    const { valid, errors } = await validateWorkspaceConfig(parsed);
    if (valid) {
      console.log(kleur.green('✓ jorvel.config.json is valid.'));
      return;
    }
    console.error(kleur.red(`✗ jorvel.config.json has ${errors.length} schema error(s):`));
    for (const e of errors) console.error(kleur.red(`  - ${e}`));
    process.exitCode = 1;
  });

export const configCommand = new Command('config')
  .description('Inspect and validate workspace configuration.')
  .addCommand(configValidateCommand);
