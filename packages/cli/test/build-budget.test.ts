import { describe, expect, it } from 'vitest';
import { checkBudgets, type BuildStats } from '../src/commands/build-stats.js';

const stats: BuildStats = {
  workspace: 'w',
  generatedAt: 'now',
  conflicts: [],
  apps: [
    { name: 'shell', type: 'host', bytes: 300_000, assets: [], shared: {} },
    { name: 'dashboard', type: 'remote', bytes: 120_000, assets: [], shared: {}, remoteEntryBytes: 90_000 },
  ],
};

describe('checkBudgets', () => {
  it('flags apps over the per-app budget', () => {
    const v = checkBudgets(stats, { perApp: 250_000 });
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ app: 'shell', kind: 'app', budget: 250_000 });
  });

  it('flags oversized remoteEntry', () => {
    const v = checkBudgets(stats, { remoteEntry: 50_000 });
    expect(v).toContainEqual(expect.objectContaining({ app: 'dashboard', kind: 'remoteEntry' }));
  });

  it('per-app override wins over perApp', () => {
    const v = checkBudgets(stats, { perApp: 250_000, apps: { shell: 500_000 } });
    expect(v).toHaveLength(0);
  });

  it('returns empty when within budget', () => {
    expect(checkBudgets(stats, { perApp: 1_000_000 })).toEqual([]);
  });
});
