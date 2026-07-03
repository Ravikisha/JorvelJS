import { describe, expect, it } from 'vitest';
import { program, PICKER_COMMANDS } from '../src/index.js';

describe('command picker', () => {
  it('every picker entry maps to a registered command', () => {
    const registered = new Set(program.commands.map((c) => c.name()));
    for (const { name } of PICKER_COMMANDS) {
      expect(registered.has(name), `command "${name}" not registered`).toBe(true);
    }
  });

  it('surfaces the core commands', () => {
    const names = PICKER_COMMANDS.map((c) => c.name);
    expect(names).toContain('dev');
    expect(names).toContain('generate');
    expect(names).toContain('federation');
  });
});
