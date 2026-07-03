import { describe, expect, it } from 'vitest';
import { setCanary, promoteCanary, rollbackCanary, type CanaryConfig } from '../src/commands/canary.js';

const empty: CanaryConfig = { remotes: {} };

describe('canary config', () => {
  it('sets a weighted split (canary + inferred stable)', () => {
    const c = setCanary(
      { remotes: { dash: [{ entryUrl: 'v1', weight: 100 }] } },
      { remote: 'dash', canaryUrl: 'v2', weight: 10 },
    );
    expect(c.remotes.dash).toEqual([
      { entryUrl: 'v2', weight: 10 },
      { entryUrl: 'v1', weight: 90 },
    ]);
  });

  it('uses an explicit stable url', () => {
    const c = setCanary(empty, { remote: 'dash', canaryUrl: 'v2', weight: 25, stableUrl: 'v1' });
    expect(c.remotes.dash).toEqual([
      { entryUrl: 'v2', weight: 25 },
      { entryUrl: 'v1', weight: 75 },
    ]);
  });

  it('rejects out-of-range weight', () => {
    expect(() => setCanary(empty, { remote: 'x', canaryUrl: 'u', weight: 150 })).toThrow(/0–100|0-100/);
  });

  it('promotes the top-weighted entry to 100%', () => {
    const c = promoteCanary({ remotes: { dash: [{ entryUrl: 'v2', weight: 30 }, { entryUrl: 'v1', weight: 70 }] } }, 'dash');
    expect(c.remotes.dash).toEqual([{ entryUrl: 'v1', weight: 100 }]);
  });

  it('rollback removes the remote entry', () => {
    const c = rollbackCanary({ remotes: { dash: [{ entryUrl: 'v2', weight: 10 }] } }, 'dash');
    expect(c.remotes.dash).toBeUndefined();
  });

  it('promote throws for an unknown remote', () => {
    expect(() => promoteCanary(empty, 'nope')).toThrow(/No canary/);
  });
});
