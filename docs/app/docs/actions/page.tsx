import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Loaders & server actions',
  description:
    'Symmetric data primitives — defineLoader (reads, @jorvel/ssr) and defineAction (mutations, @jorvel/runtime) — plus useAction and useFormAction for React 19 form-action state.',
};

export default function Actions() {
  return (
    <>
      <h1>Loaders &amp; server actions</h1>
      <p>
        JORVEL splits data into two symmetric primitives: <code>defineLoader</code> for{' '}
        <strong>reads</strong> and <code>defineAction</code> for <strong>mutations</strong>. Reads
        run before render and hydrate without a second fetch; mutations carry pending / error /
        result state. The React hooks — <code>useAction</code> and <code>useFormAction</code> — add
        the state machine expected of React 19 form actions.
      </p>

      <h2 id="loaders">Loaders (reads)</h2>
      <p>
        <code>defineLoader</code> lives in <code>@jorvel/ssr</code>. It registers a keyed loader that
        runs before render; components read the result via <code>useLoaderData&lt;T&gt;(key)</code>{' '}
        with no client refetch. See the <a href="/docs/ssr">SSR docs</a> for the full loader
        lifecycle; on the client, the Suspense-friendly <code>useRemoteData</code> covers ad-hoc
        reads.
      </p>
      <CodeBlock
        language="ts"
        code={`import { defineLoader, useLoaderData } from '@jorvel/ssr';

export const userLoader = defineLoader<User>({
  key: 'user',
  load: async ({ params, request }) => {
    const res = await fetch(new URL('/api/users/' + params.id, request.url));
    if (!res.ok) throw new Error('User ' + params.id + ' not found');
    return res.json();
  },
});

// in the component:  const user = useLoaderData<User>('user');`}
      />

      <h2 id="actions">Actions (mutations)</h2>
      <p>
        <code>defineAction</code> is the write counterpart — a typed <code>(input) =&gt; output</code>
        function. It is the "server action" primitive: call it from an event handler, a form, or
        directly from a route.
      </p>
      <CodeBlock
        language="ts"
        code={`import { defineAction } from '@jorvel/runtime';

export const updateProfile = defineAction(async (input: { id: string; name: string }) => {
  const res = await fetch('/api/users/' + input.id, {
    method: 'PATCH',
    body: JSON.stringify({ name: input.name }),
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json() as Promise<User>;
});`}
      />

      <h2 id="use-action">useAction</h2>
      <p>
        Drive an action with React state: <code>{'{ data, error, pending, submit, reset }'}</code>.
        Concurrent submissions are serialized <em>last-wins</em> — a slow earlier request can never
        clobber a newer result, and state updates after unmount are dropped.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { useAction } from '@jorvel/runtime';
import { updateProfile } from './actions.js';

function ProfileForm({ user }: { user: User }) {
  const { submit, pending, error, data } = useAction(updateProfile);

  return (
    <div>
      <button disabled={pending} onClick={() => submit({ id: user.id, name: 'Ada' })}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      {error ? <p role="alert">{String(error)}</p> : null}
      {data ? <p>Saved {data.name}</p> : null}
    </div>
  );
}`}
      />

      <h2 id="use-form-action">useFormAction — progressive enhancement</h2>
      <p>
        <code>useFormAction</code> binds a <code>FormData</code> action directly to a{' '}
        <code>&lt;form&gt;</code>. With JS it intercepts submit, serializes <code>FormData</code>, and
        exposes pending/error/data. Wire the <em>same</em> action server-side and the form still
        posts natively without JS.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { defineAction, useFormAction } from '@jorvel/runtime';

const subscribe = defineAction(async (fd: FormData) => {
  const res = await fetch('/api/subscribe', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Subscribe failed');
  return 'ok';
});

function NewsletterForm() {
  const { onSubmit, pending, error } = useFormAction(subscribe);
  return (
    <form action="/api/subscribe" method="post" onSubmit={onSubmit}>
      <input name="email" type="email" required />
      <button disabled={pending}>{pending ? 'Joining…' : 'Join'}</button>
      {error ? <p role="alert">{String(error)}</p> : null}
    </form>
  );
}`}
      />

      <h2 id="use-promise">use(promise) — read a promise in render</h2>
      <p>
        React 19&apos;s <code>use()</code>, available on React 18: read a promise during render —
        suspend while pending, return the value when resolved. Wrap in <code>&lt;Suspense&gt;</code>;
        pass a stable promise (from a loader/cache, not created inline).
      </p>
      <CodeBlock
        language="tsx"
        code={`import { use } from '@jorvel/runtime';

function Profile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise);   // suspends until resolved, throws to ErrorBoundary on reject
  return <h1>{user.name}</h1>;
}`}
      />

      <h2 id="streaming">Streaming Suspense route data</h2>
      <p>
        Combine <code>use(promise)</code> with a route-level <code>&lt;Suspense&gt;</code> to stream:
        start the fetch in the loader, pass the promise down, and let the shell render while data
        resolves. On the server, <code>renderToReadableStream</code> flushes the fallback then the
        resolved content.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { Suspense } from 'react';
import { use } from '@jorvel/runtime';

function Page({ dataPromise }: { dataPromise: Promise<Data> }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Content dataPromise={dataPromise} />
    </Suspense>
  );
}
function Content({ dataPromise }: { dataPromise: Promise<Data> }) {
  const data = use(dataPromise);   // suspends the boundary until resolved
  return <Detail data={data} />;
}
// SSR: renderToReadableStream(App) streams <Skeleton/> first, then <Detail/> when the promise settles.`}
      />

      <h2 id="use-query">useQuery — client cache (TanStack-style)</h2>
      <p>
        For client-driven data with caching + stale-while-revalidate, use the built-in{' '}
        <code>QueryClient</code> + <code>useQuery</code> / <code>useMutation</code> — a small
        TanStack-Query-shaped layer (dedupe, background refetch, optimistic{' '}
        <code>setQueryData</code>, prefix invalidation). Wrap the tree in{' '}
        <code>QueryClientProvider</code> (optional — a globalThis-pinned default client is used
        otherwise).
      </p>
      <CodeBlock
        language="tsx"
        code={`import { useQuery, useMutation, useQueryClient } from '@jorvel/runtime';

function Todos() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then((r) => r.json()),
    staleTime: 30_000,           // serve cache for 30s, then background-refetch
  });

  const add = useMutation({
    mutationFn: (title: string) => fetch('/api/todos', { method: 'POST', body: title }),
    onSuccess: () => qc.invalidate(['todos']),   // refetch the list
  });

  if (isLoading) return <p>Loading…</p>;
  return (
    <>
      <ul>{data.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
      <button disabled={add.isPending} onClick={() => add.mutate('New')}>Add</button>
    </>
  );
}`}
      />
      <p>
        <code>QueryClient</code> methods: <code>setQueryData</code> (optimistic/hydration),{' '}
        <code>invalidate(prefix | predicate)</code>, <code>prefetch</code>, <code>isStale</code>. Use
        it when the client owns fetching; use <code>defineLoader</code> when the server should.
      </p>

      <h2 id="revalidate">Cache tags &amp; revalidation</h2>
      <p>
        Tag a <code>useRemoteData</code> read, then invalidate it after a mutation with{' '}
        <code>revalidateTag</code> / <code>revalidatePath</code> — Next-style. Purging an entry makes
        the next render refetch. Compose <code>useRevalidationVersion()</code> in a component so it
        re-renders (and re-suspends) automatically when a tag it depends on is revalidated.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { useRemoteData, revalidateTag, useRevalidationVersion } from '@jorvel/runtime';
import { useAction } from '@jorvel/runtime';
import { updateProfile } from './actions.js';

function Profile({ id }: { id: string }) {
  useRevalidationVersion();                 // re-render when any tag is revalidated
  const user = useRemoteData({
    key: 'user:' + id,
    fetcher: () => fetch('/api/users/' + id).then((r) => r.json()),
    tags: ['user:' + id, 'users'],
  });

  const { submit } = useAction(updateProfile);
  const save = async (name: string) => {
    await submit({ id, name });
    revalidateTag('user:' + id);            // drop the cache → refetch fresh
  };
  // …
}`}
      />
      <p>
        <code>revalidatePath(p)</code> is sugar for <code>revalidateTag(p)</code> — tag loaders with
        a route path (<code>tags: [&apos;/dashboard&apos;]</code>) to invalidate a whole page&apos;s data.{' '}
        <code>invalidateRemoteData(key)</code> purges one key; <code>clearRemoteDataCache()</code>{' '}
        wipes everything.
      </p>

      <h2 id="optimistic">Optimistic UI</h2>
      <p>
        <code>useOptimistic</code> shows a predicted state instantly while a mutation is in flight,
        then drops the overlay when the authoritative state arrives. Same shape as React 19&apos;s
        built-in, available on React 18.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { useOptimistic, useAction } from '@jorvel/runtime';

function TodoList({ todos }: { todos: Todo[] }) {
  const [optimistic, addOptimistic] = useOptimistic(
    todos,
    (cur, next: Todo) => [...cur, next],
  );
  const { submit } = useAction(createTodo);

  async function add(title: string) {
    addOptimistic({ id: 'temp', title, pending: true });  // shows immediately
    await submit({ title });                               // overlay clears when \`todos\` updates
  }

  return <ul>{optimistic.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;
}`}
      />

      <Callout variant="info" title="Symmetry with loaders">
        Reads go through <code>defineLoader</code> (cache, SSR, Suspense via <code>useRemoteData</code>);
        writes go through <code>defineAction</code> (pending/error state via <code>useAction</code>).
        Keeping them separate makes caching and revalidation explicit instead of guessed.
      </Callout>

      <Callout variant="warn" title="Validate inputs in the action">
        An action is a trust boundary when wired to a server route. Validate{' '}
        <code>input</code> / <code>FormData</code> (Zod/Valibot) inside the action — never assume the
        client sent what the types claim.
      </Callout>
    </>
  );
}
