import type { SolidRemoteProps } from '@jorvel/adapter-solid';

export default function Root(props: SolidRemoteProps) {
  return (
    <section class="jorvel-remote">
      <h1>widgets <small>(SolidJS remote)</small></h1>
      <p>Sub-path: <code>{props.subpath}</code></p>
      <p>This remote is mounted by the host through <code>@jorvel/mount</code>.</p>
    </section>
  );
}
