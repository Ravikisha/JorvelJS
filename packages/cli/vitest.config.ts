import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Several suites `process.chdir()` and spawn `tsc`/`jorvel generate`. Running
    // files in parallel workers races the shared process cwd and oversubscribes
    // the CPU (flaky tsc timeouts). One fork, sequential, is deterministic.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 60_000,
  },
});
