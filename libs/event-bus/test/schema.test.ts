import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/index.js';
import { attachSchemaRegistry, type Validator } from '../src/schema.js';

type Events = {
  'cart:add': { sku: string; qty: number };
  'cart:remove': { sku: string };
}

const skuRequired: Validator<Events['cart:add']> = {
  parse(input) {
    const o = input as Partial<Events['cart:add']>;
    if (typeof o?.sku !== 'string' || o.sku.length === 0) {
      throw new Error('sku required');
    }
    if (typeof o.qty !== 'number') {
      throw new Error('qty must be number');
    }
    return { sku: o.sku, qty: o.qty };
  },
  safeParse(input) {
    try {
      return { success: true, data: this.parse(input) };
    } catch (error) {
      return { success: false, error };
    }
  },
};

describe('attachSchemaRegistry', () => {
  it('passes valid payloads through and delivers to listeners', () => {
    const bus = new EventBus<Events>();
    attachSchemaRegistry(bus, { 'cart:add': skuRequired });
    const seen = vi.fn();
    bus.on('cart:add', seen);

    bus.emit('cart:add', { sku: 'A', qty: 2 });
    expect(seen).toHaveBeenCalledWith({ sku: 'A', qty: 2 });
  });

  it('default mode warn: invalid payload still reaches listeners + logs', () => {
    const bus = new EventBus<Events>();
    const log = vi.fn();
    attachSchemaRegistry(bus, { 'cart:add': skuRequired }, { log });
    const seen = vi.fn();
    bus.on('cart:add', seen);

    bus.emit('cart:add', { sku: '', qty: 2 } as never);
    expect(log).toHaveBeenCalledWith('cart:add', expect.any(Error));
    expect(seen).toHaveBeenCalled();
  });

  it('mode throw: emit re-raises the parser error', () => {
    const bus = new EventBus<Events>();
    attachSchemaRegistry(bus, { 'cart:add': skuRequired }, { onInvalid: 'throw' });
    expect(() => bus.emit('cart:add', { qty: 1 } as never)).toThrow(/sku required/);
  });

  it('mode drop: invalid emit is silently swallowed', () => {
    const bus = new EventBus<Events>();
    attachSchemaRegistry(bus, { 'cart:add': skuRequired }, { onInvalid: 'drop' });
    const seen = vi.fn();
    bus.on('cart:add', seen);
    bus.emit('cart:add', { sku: '', qty: 1 } as never);
    expect(seen).not.toHaveBeenCalled();
  });

  it('events without a registered schema are passthrough', () => {
    const bus = new EventBus<Events>();
    attachSchemaRegistry(bus, { 'cart:add': skuRequired });
    const seen = vi.fn();
    bus.on('cart:remove', seen);
    bus.emit('cart:remove', { sku: 'X' });
    expect(seen).toHaveBeenCalledWith({ sku: 'X' });
  });

  it('uses parse() when safeParse missing', () => {
    const v: Validator<{ x: number }> = {
      parse: (i) => {
        if (typeof (i as { x: number }).x !== 'number') throw new Error('bad');
        return i as { x: number };
      },
    };
    type E = { 'n': { x: number } };
    const bus = new EventBus<E>();
    attachSchemaRegistry(bus, { n: v }, { onInvalid: 'throw' });
    expect(() => bus.emit('n', { x: 'no' } as never)).toThrow(/bad/);
  });

  it('detach restores the original emit', () => {
    const bus = new EventBus<Events>();
    const h = attachSchemaRegistry(bus, { 'cart:add': skuRequired }, { onInvalid: 'throw' });
    h.detach();
    // After detach, invalid payload should not throw.
    expect(() => bus.emit('cart:add', { sku: '', qty: 1 } as never)).not.toThrow();
  });

  it('transforms payload via parse() return value', () => {
    type E = { 'msg': { id: string } };
    const v: Validator<{ id: string }> = {
      parse: (i) => ({ id: String((i as { id: unknown }).id).toUpperCase() }),
    };
    const bus = new EventBus<E>();
    attachSchemaRegistry(bus, { msg: v });
    const seen = vi.fn();
    bus.on('msg', seen);
    bus.emit('msg', { id: 'abc' });
    expect(seen).toHaveBeenCalledWith({ id: 'ABC' });
  });
});
