# @jorvel/adapter-angular

Expose a **standalone Angular** component through the framework-neutral
[`@jorvel/mount`](../mount) contract.

```ts
import { defineAngularRemote } from '@jorvel/adapter-angular';
import { RootComponent } from './root.component';

export default defineAngularRemote(RootComponent, {
  providers: [/* provideHttpClient(), provideRouter(routes), … */],
});
```

Uses the modern standalone bootstrap API (`createApplication` +
`createComponent`) — no `NgModule`. Declare `@Input()` fields on the root to
receive routing context:

```ts
@Component({ standalone: true, selector: 'app-root', template: `…` })
export class RootComponent {
  @Input() subpath = '/';
  @Input() basePath = '/';
  @Input() params: Record<string, string> = {};
}
```

`@angular/core` and `@angular/platform-browser` are peer dependencies provided
by the remote app. The adapter imports them lazily (only when a remote is
actually mounted), so it loads fine in environments without Angular.
