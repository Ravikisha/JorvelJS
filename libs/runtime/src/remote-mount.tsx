import * as React from 'react';
import {
  mountRemoteModule,
  type JorvelMountContext,
  type JorvelMountModule,
  type JorvelUnmount,
} from '@jorvel/mount';

export type { JorvelMountContext, JorvelMountModule, JorvelUnmount } from '@jorvel/mount';
export { isMountModule, asMountModule } from '@jorvel/mount';

export type RemoteMountOutletProps = {
  /** A framework-neutral mount module (e.g. from `@jorvel/adapter-react`, or a Vue/Angular/Solid remote). */
  module: JorvelMountModule;
  /** Path relative to the remote's mount prefix. */
  subpath?: string;
  /** The prefix the host mounted this remote under. */
  basePath?: string;
  /** Route params matched by the host. */
  params?: Record<string, string>;
  /** Arbitrary props forwarded to the remote. */
  props?: Record<string, unknown>;
  /** Class on the wrapper node the remote mounts into. */
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Bridge a framework-neutral mount module into a React host tree.
 *
 * Renders a plain `<div>` the remote owns and drives its `mount`/`unmount`
 * lifecycle from an effect — so a React host can embed a remote built with ANY
 * framework (or a React remote wrapped via `@jorvel/adapter-react`).
 *
 * Re-mounts when the module or the mount identity (`subpath`/`basePath`)
 * changes; an `AbortSignal` is passed to the remote and aborted on teardown.
 */
export function RemoteMountOutlet({
  module,
  subpath = '/',
  basePath = '/',
  params,
  props,
  className,
  style,
}: RemoteMountOutletProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  // Keep the latest params/props without forcing a re-mount on every parent
  // render — the mount identity is (module, subpath, basePath).
  const paramsRef = React.useRef(params);
  const propsRef = React.useRef(props);
  paramsRef.current = params;
  propsRef.current = props;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const controller = new AbortController();
    const ctx: JorvelMountContext = {
      el,
      subpath,
      basePath,
      params: paramsRef.current ?? {},
      signal: controller.signal,
      ...(propsRef.current !== undefined ? { props: propsRef.current } : {}),
    };

    let dispose: JorvelUnmount | undefined;
    try {
      dispose = mountRemoteModule(module, ctx);
    } catch (err) {
      el.textContent = err instanceof Error ? err.message : String(err);
    }

    return () => {
      controller.abort();
      try {
        dispose?.();
      } catch {
        /* teardown errors must not break navigation */
      }
    };
  }, [module, subpath, basePath]);

  return (
    <div
      ref={ref}
      data-jorvel-remote-mount=""
      {...(className !== undefined ? { className } : {})}
      {...(style !== undefined ? { style } : {})}
    />
  );
}
