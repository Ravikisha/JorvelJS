import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'jorvel-reports-root',
  template: `
    <section class="jorvel-remote">
      <h1>reports <small>(Angular remote)</small></h1>
      <p>Sub-path: <code>{{ subpath }}</code></p>
      <p>This remote is mounted by the host through &#64;jorvel/mount.</p>
    </section>
  `,
})
export class RootComponent {
  @Input() subpath = '/';
  @Input() basePath = '/';
  @Input() params: Record<string, string> = {};
}
