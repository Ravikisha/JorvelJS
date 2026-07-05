import { describe, expect, it, vi } from 'vitest';
import { toCustomElement, defineCustomElement } from '../src/index.js';
import type { JorvelMountContext, JorvelMountModule } from '../src/index.js';

// A vanilla mount module that records the context it received and renders text.
function makeModule(seen: JorvelMountContext[]): JorvelMountModule {
  return {
    mount(ctx) {
      seen.push(ctx);
      ctx.el.innerHTML = `<em>${ctx.subpath}</em>`;
      return () => {
        ctx.el.innerHTML = '';
      };
    },
  };
}

let tagN = 0;
const nextTag = () => `jorvel-test-${tagN++}`;

describe('toCustomElement', () => {
  it('mounts into light DOM on connect with attribute-driven context', () => {
    const seen: JorvelMountContext[] = [];
    const tag = nextTag();
    customElements.define(tag, toCustomElement(makeModule(seen)));

    const el = document.createElement(tag);
    el.setAttribute('subpath', '/plans');
    el.setAttribute('basepath', '/pricing');
    el.setAttribute('params', JSON.stringify({ id: '7' }));
    document.body.appendChild(el);

    expect(el.querySelector('em')?.textContent).toBe('/plans');
    expect(seen[0]!.basePath).toBe('/pricing');
    expect(seen[0]!.params).toEqual({ id: '7' });

    el.remove();
    expect(el.querySelector('em')).toBeNull(); // disposed on disconnect
  });

  it('defaults subpath/basePath and tolerates malformed params', () => {
    const seen: JorvelMountContext[] = [];
    const tag = nextTag();
    customElements.define(tag, toCustomElement(makeModule(seen)));
    const el = document.createElement(tag);
    el.setAttribute('params', '{not json');
    document.body.appendChild(el);
    expect(seen[0]!.subpath).toBe('/');
    expect(seen[0]!.basePath).toBe('/');
    expect(seen[0]!.params).toEqual({});
    el.remove();
  });

  it('re-mounts when subpath changes', () => {
    const seen: JorvelMountContext[] = [];
    const tag = nextTag();
    customElements.define(tag, toCustomElement(makeModule(seen)));
    const el = document.createElement(tag);
    el.setAttribute('subpath', '/a');
    document.body.appendChild(el);
    el.setAttribute('subpath', '/b');
    expect(seen.map((c) => c.subpath)).toEqual(['/a', '/b']);
    el.remove();
  });

  it('forwards observed extra attributes as camelCased props', () => {
    const seen: JorvelMountContext[] = [];
    const tag = nextTag();
    customElements.define(tag, toCustomElement(makeModule(seen), { observedAttributes: ['data-theme'] }));
    const el = document.createElement(tag);
    el.setAttribute('data-theme', 'dark');
    document.body.appendChild(el);
    expect(seen[0]!.props).toEqual({ dataTheme: 'dark' });
    el.remove();
  });

  it('mounts into a shadow root when shadow:true', () => {
    const seen: JorvelMountContext[] = [];
    const tag = nextTag();
    customElements.define(tag, toCustomElement(makeModule(seen), { shadow: true }));
    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot!.querySelector('em')?.textContent).toBe('/');
    el.remove();
  });
});

describe('defineCustomElement', () => {
  it('registers the element and is idempotent', () => {
    const tag = nextTag();
    const mod = makeModule([]);
    defineCustomElement(tag, mod);
    expect(customElements.get(tag)).toBeTypeOf('function');
    // second call must not throw (already registered)
    const spy = vi.spyOn(customElements, 'define');
    defineCustomElement(tag, mod);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
