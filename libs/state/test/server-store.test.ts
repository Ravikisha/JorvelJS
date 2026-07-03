import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createServerStore,
  createHydratedStore,
  dehydrateAll,
  serializeState,
  readHydratedState,
} from '../src/server-store.js';

afterEach(() => { delete (globalThis as Record<string, unknown>)['__JORVEL_STATE__']; });

describe('server store', () => {
  it('gets/sets/subscribes and dehydrates', () => {
    const s = createServerStore({ count: 0 });
    const spy = vi.fn();
    s.subscribe(spy);
    s.set((p) => ({ count: p.count + 1 }));
    expect(s.get()).toEqual({ count: 1 });
    expect(spy).toHaveBeenCalledWith({ count: 1 });
    expect(s.dehydrate()).toEqual({ count: 1 });
  });

  it('dehydrateAll + serializeState escapes </script>', () => {
    const a = createServerStore({ v: 'x</script>' });
    const payload = dehydrateAll({ a });
    expect(payload).toEqual({ a: { v: 'x</script>' } });
    const str = serializeState(payload);
    expect(str).not.toContain('</script>');
    expect(str).toContain('\\u003c/script>');
  });

  it('hydrates from an embedded snapshot', () => {
    (globalThis as Record<string, unknown>)['__JORVEL_STATE__'] = { session: { user: 'ada' } };
    expect(readHydratedState('session')).toEqual({ user: 'ada' });
    const store = createHydratedStore('session', { user: null as string | null });
    expect(store.get()).toEqual({ user: 'ada' });
  });

  it('falls back when no snapshot present', () => {
    const store = createHydratedStore('missing', { n: 5 });
    expect(store.get()).toEqual({ n: 5 });
  });
});
