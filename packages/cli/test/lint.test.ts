import { afterEach, describe, expect, it, vi } from 'vitest';

import { lintCommand } from '../src/commands/lint.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

async function run(argv: string[]): Promise<number> {
  lintCommand.exitOverride();
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`__exit__:${code ?? 0}`);
  });
  try {
    await lintCommand.parseAsync(['lint', ...argv], { from: 'user' });
    return 0;
  } catch (e) {
    const m = /^__exit__:(\d+)$/.exec((e as Error).message);
    if (m) return Number(m[1]);
    throw e;
  } finally {
    exitSpy.mockRestore();
  }
}

afterEach(() => vi.resetAllMocks());

describe('jorvel lint', () => {
  it('invokes `pnpm -r lint`', async () => {
    const { execa } = await import('execa');
    (execa as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await run([]);
    expect(execa).toHaveBeenCalledWith('pnpm', ['-r', '--if-present', 'lint'], expect.objectContaining({ stdio: 'inherit' }));
  });

  it('passes --fix through to eslint', async () => {
    const { execa } = await import('execa');
    (execa as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await run(['--fix']);
    expect(execa).toHaveBeenCalledWith('pnpm', ['-r', '--if-present', 'lint', '--', '--fix'], expect.any(Object));
  });

  it('exits 1 when execa rejects', async () => {
    const { execa } = await import('execa');
    (execa as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('eslint failed'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await run([]);
    expect(code).toBe(1);
  });
});
