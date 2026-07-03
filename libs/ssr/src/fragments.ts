/**
 * Stream remote fragments (Cloudflare Fragments pattern).
 *
 * Host emits a shell with `<jorvel-fragment name="...">` placeholders. Each
 * remote SSRs its own slice in parallel, and the host swaps the placeholder
 * for the streamed HTML. When a fragment fails / times out, its `fallback`
 * markup is used instead.
 *
 * Two surfaces:
 *   - `renderFragmentsToString(...)`   — concatenated single-shot HTML
 *   - `renderFragmentsToReadableStream` — Web ReadableStream that flushes the
 *     shell head, then each fragment as it resolves (parallel, out-of-order
 *     OK, then placed back into its slot via a tiny inline script).
 *
 * Pure-data; works in Workers, Edge, Node.
 */

export interface FragmentSpec {
  name: string;
  /** Async fragment renderer — returns the HTML for this slot. */
  render: (signal: AbortSignal) => Promise<string>;
  /** Markup if `render` fails or times out. Default: empty string. */
  fallback?: string;
  /** Per-fragment timeout. Default: parent `timeoutMs`. */
  timeoutMs?: number;
}

export interface RenderFragmentsOptions {
  /** Shell HTML containing `<jorvel-fragment name="...">` placeholders. */
  shell: string;
  fragments: FragmentSpec[];
  /** Default timeout for every fragment. Default: 5_000. */
  timeoutMs?: number;
  /** External cancel signal (e.g. client disconnect). */
  signal?: AbortSignal;
  /** Per-fragment outcome — useful for telemetry. */
  onFragment?: (event: FragmentOutcome) => void;
  /**
   * CSP nonce applied to the runtime + per-fragment `<script>` tags. Required
   * when serving under a `script-src 'nonce-…'` policy, otherwise the fragment
   * swap scripts are blocked and fragments stay stuck on their fallback.
   */
  nonce?: string;
}

/**
 * Fragment names are reflected into a DOM id and a `[name="…"]` attribute
 * selector, so they must be restricted to a selector-safe charset. The SAME
 * sanitized value must be used for the placeholder attribute, the data-script
 * id, and the runtime swap call — otherwise the runtime query never matches.
 */
function sanitizeFragmentName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export type FragmentOutcome =
  | { name: string; phase: 'success'; ms: number; bytes: number }
  | { name: string; phase: 'failed'; ms: number; error: Error }
  | { name: string; phase: 'timeout'; ms: number };

const PLACEHOLDER_RE = /<jorvel-fragment\s+name=["']([^"']+)["']\s*\/?>(?:<\/jorvel-fragment>)?/g;

export interface RenderFragmentsResult {
  html: string;
  outcomes: FragmentOutcome[];
}

export async function renderFragmentsToString(opts: RenderFragmentsOptions): Promise<RenderFragmentsResult> {
  const outcomes: FragmentOutcome[] = [];
  const settled = await runFragments(opts, outcomes);
  const html = opts.shell.replace(PLACEHOLDER_RE, (_full, name: string) =>
    settled.get(name) ?? '',
  );
  return { html, outcomes };
}

async function runFragments(
  opts: RenderFragmentsOptions,
  outcomes: FragmentOutcome[],
): Promise<Map<string, string>> {
  const defaultTimeout = opts.timeoutMs ?? 5_000;
  const settled = new Map<string, string>();
  await Promise.all(opts.fragments.map(async (frag) => {
    const start = Date.now();
    const innerController = new AbortController();
    const linkAbort = () => innerController.abort();
    if (opts.signal) {
      if (opts.signal.aborted) innerController.abort();
      else opts.signal.addEventListener('abort', linkAbort, { once: true });
    }
    const fragTimeoutMs = frag.timeoutMs ?? defaultTimeout;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        innerController.abort();
        reject(new Error(`fragment "${frag.name}" timed out after ${fragTimeoutMs}ms`));
      }, fragTimeoutMs);
    });
    try {
      const html = await Promise.race([frag.render(innerController.signal), timeoutPromise]);
      settled.set(frag.name, html);
      const outcome: FragmentOutcome = {
        name: frag.name, phase: 'success', ms: Date.now() - start, bytes: html.length,
      };
      outcomes.push(outcome);
      opts.onFragment?.(outcome);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      const isTimeout = e.message.includes('timed out after');
      settled.set(frag.name, frag.fallback ?? '');
      const outcome: FragmentOutcome = isTimeout
        ? { name: frag.name, phase: 'timeout', ms: Date.now() - start }
        : { name: frag.name, phase: 'failed', ms: Date.now() - start, error: e };
      outcomes.push(outcome);
      opts.onFragment?.(outcome);
    } finally {
      if (timer) clearTimeout(timer);
      if (opts.signal) opts.signal.removeEventListener('abort', linkAbort);
    }
  }));
  return settled;
}

function nonceAttr(nonce?: string): string {
  return nonce ? ` nonce="${nonce}"` : '';
}

function runtimeScript(nonce?: string): string {
  return `<script data-jorvel-fragments${nonceAttr(nonce)}>(()=>{const r=window.__jorvelFragment||(window.__jorvelFragment=n=>{const s=document.getElementById('jorvel-frag-data-'+n);const t=document.querySelector('jorvel-fragment[name="'+n+'"]');if(s&&t){t.outerHTML=s.textContent||'';s.remove();}});})();</script>`;
}

export interface RenderFragmentsStreamResult {
  stream: ReadableStream<Uint8Array>;
  done: Promise<{ outcomes: FragmentOutcome[] }>;
}

export function renderFragmentsToReadableStream(opts: RenderFragmentsOptions): RenderFragmentsStreamResult {
  const enc = new TextEncoder();
  const outcomes: FragmentOutcome[] = [];
  const defaultTimeout = opts.timeoutMs ?? 5_000;

  let resolveDone!: (v: { outcomes: FragmentOutcome[] }) => void;
  const done = new Promise<{ outcomes: FragmentOutcome[] }>((res) => { resolveDone = res; });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 1. Replace all placeholders with anchor markers; flush the shell. The
      //    placeholder's name attribute uses the SANITIZED name so it matches the
      //    runtime's `[name="…"]` query (and the id used in flushFragment).
      const shellPatched = opts.shell.replace(PLACEHOLDER_RE, (_full, name: string) =>
        `<jorvel-fragment name="${sanitizeFragmentName(name)}">${renderFallbackInline(opts.fragments, name)}</jorvel-fragment>`,
      );
      controller.enqueue(enc.encode(shellPatched));
      controller.enqueue(enc.encode(runtimeScript(opts.nonce)));

      // 2. Race each fragment; as they resolve, flush a <template> + the
      //    inline call that swaps the placeholder.
      await Promise.all(opts.fragments.map(async (frag) => {
        const start = Date.now();
        const innerController = new AbortController();
        const linkAbort = () => innerController.abort();
        if (opts.signal) {
          if (opts.signal.aborted) innerController.abort();
          else opts.signal.addEventListener('abort', linkAbort, { once: true });
        }
        const fragTimeoutMs = frag.timeoutMs ?? defaultTimeout;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            innerController.abort();
            reject(new Error(`fragment "${frag.name}" timed out after ${fragTimeoutMs}ms`));
          }, fragTimeoutMs);
        });
        try {
          const html = await Promise.race([frag.render(innerController.signal), timeoutPromise]);
          const outcome: FragmentOutcome = { name: frag.name, phase: 'success', ms: Date.now() - start, bytes: html.length };
          outcomes.push(outcome);
          opts.onFragment?.(outcome);
          flushFragment(controller, enc, frag.name, html, opts.nonce);
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          const isTimeout = e.message.includes('timed out after');
          const outcome: FragmentOutcome = isTimeout
            ? { name: frag.name, phase: 'timeout', ms: Date.now() - start }
            : { name: frag.name, phase: 'failed', ms: Date.now() - start, error: e };
          outcomes.push(outcome);
          opts.onFragment?.(outcome);
          // Leave the fallback (already inline) in place — no further flush.
        } finally {
          if (timer) clearTimeout(timer);
          if (opts.signal) opts.signal.removeEventListener('abort', linkAbort);
        }
      }));

      controller.close();
      resolveDone({ outcomes });
    },
  });

  return { stream, done };
}

function renderFallbackInline(fragments: FragmentSpec[], name: string): string {
  const f = fragments.find((x) => x.name === name);
  return f?.fallback ?? '';
}

function flushFragment(
  controller: ReadableStreamDefaultController<Uint8Array>,
  enc: TextEncoder,
  name: string,
  html: string,
  nonce?: string,
): void {
  // Embed the fragment HTML in a script-typed template so the browser doesn't
  // execute or parse it until the runtime swaps it. Escape `</script` to keep
  // the wrapper closed.
  const safeId = sanitizeFragmentName(name);
  const safeHtml = html.replace(/<\/script/gi, '<\\/script');
  // The data <script> is type="text/template" (inert — no nonce needed); the
  // swap call <script> executes, so it carries the nonce.
  const chunk =
    `<script id="jorvel-frag-data-${safeId}" type="text/template">${safeHtml}</script>` +
    `<script${nonceAttr(nonce)}>window.__jorvelFragment(${JSON.stringify(safeId)})</script>`;
  controller.enqueue(enc.encode(chunk));
}
