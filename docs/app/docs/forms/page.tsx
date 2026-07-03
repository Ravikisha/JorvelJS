import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Forms & CSRF',
  description:
    'Progressive-enhancement <Form> bound to a server action, plus a signed double-submit CSRF helper.',
};

export default function Forms() {
  return (
    <>
      <h1>Forms &amp; CSRF</h1>
      <p>
        The <code>&lt;Form&gt;</code> component (<code>@jorvel/runtime</code>) binds a{' '}
        <a href="/docs/actions">server action</a> to a real <code>&lt;form&gt;</code> with pending /
        error / data state and progressive enhancement. CSRF protection comes from a signed
        double-submit cookie in <code>@jorvel/security</code>.
      </p>

      <h2 id="form">The &lt;Form&gt; component</h2>
      <p>
        <code>&lt;Form&gt;</code> renders a native <code>&lt;form&gt;</code>, intercepts submit with
        JS, serializes <code>FormData</code>, and runs your action. Pass a render-fn child to read{' '}
        <code>{'{ pending, error, data, reset }'}</code>. Set <code>formAction</code> for the no-JS
        native-POST fallback.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { Form, defineAction } from '@jorvel/runtime';

const createPost = defineAction(async (fd: FormData) => {
  const res = await fetch('/api/posts', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Create failed');
  return res.json();
});

function NewPost({ csrfToken }: { csrfToken: string }) {
  return (
    <Form action={createPost} formAction="/api/posts" csrf={{ token: csrfToken }}>
      {({ pending, error, data }) => (
        <>
          <input name="title" required />
          <textarea name="body" />
          <button disabled={pending}>{pending ? 'Saving…' : 'Publish'}</button>
          {error ? <p role="alert">{String(error)}</p> : null}
          {data ? <p>Published #{data.id}</p> : null}
        </>
      )}
    </Form>
  );
}`}
      />

      <h2 id="csrf">CSRF — signed double-submit cookie</h2>
      <p>
        On a safe request, issue a token: set a (non-<code>HttpOnly</code>) cookie and hand the same
        token to the page. On an unsafe request, the client echoes it (header or hidden field) and{' '}
        <code>verifyCsrf</code> checks the echo equals the cookie. With a <code>secret</code>, tokens
        are HMAC-signed so an attacker who can only <em>set</em> cookies — not read the signed value
        — can&apos;t forge a matching pair.
      </p>
      <CodeBlock
        language="ts"
        code={`import { issueCsrfToken, verifyCsrf } from '@jorvel/security';

// GET a form page — issue the token:
const { token, setCookie } = await issueCsrfToken({ secret: process.env.CSRF_SECRET });
// → render <Form csrf={{ token }} /> AND return the Set-Cookie header

// POST handler — verify before mutating:
const result = await verifyCsrf(request, { secret: process.env.CSRF_SECRET });
if (!result.ok) {
  return new Response('CSRF: ' + result.reason, { status: 403 });
}
// … safe to process the mutation`}
      />
      <p>
        Safe methods (GET/HEAD/OPTIONS) always pass. For <code>multipart</code> / urlencoded posts
        where the token rides in a form field, parse the field and pass it explicitly:{' '}
        <code>verifyCsrf(request, opts, formData.get(csrfFieldName()))</code>.
      </p>

      <h2 id="wiring">End-to-end wiring</h2>
      <CodeBlock
        language="ts"
        code={`import { issueCsrfToken, verifyCsrf, csrfFieldName } from '@jorvel/security';

// 1. render the page
const { token, setCookie } = await issueCsrfToken({ secret });
const html = renderPage(<NewPost csrfToken={token} />);  // <Form> injects a hidden _csrf input
return new Response(html, { headers: { 'set-cookie': setCookie, 'content-type': 'text/html' } });

// 2. handle the action POST
const form = await request.formData();
const check = await verifyCsrf(request, { secret }, String(form.get(csrfFieldName()) ?? ''));
if (!check.ok) return new Response('Forbidden', { status: 403 });`}
      />

      <Callout variant="warn" title="The CSRF cookie is intentionally readable">
        Double-submit requires the page to read the token, so the CSRF cookie is NOT{' '}
        <code>HttpOnly</code> — unlike the session cookie. That is safe: the cookie carries no
        authority on its own, only a value that must match the echoed token.
      </Callout>

      <h2 id="file-upload">File uploads (multipart)</h2>
      <p>
        Parse <code>multipart/form-data</code> in any runtime with the dependency-free parser —
        fields come back as strings, files as <code>Uint8Array</code>.
      </p>
      <CodeBlock
        language="ts"
        code={`import { parseMultipartRequest } from '@jorvel/security';

// inside an action / server route:
const { fields, files } = await parseMultipartRequest(request);
for (const f of files) {
  // f: { name, filename, contentType, data: Uint8Array }
  await storage.put(f.filename, f.data);
}
console.log(fields.title);`}
      />

      <h2 id="validation">Input validation</h2>
      <p>
        Validate action/form inputs with the built-in schema (or any{' '}
        <code>{'{ parse(input) }'}</code> validator — Zod/Valibot drop in). An action is a trust
        boundary; validate before you touch the DB.
      </p>
      <CodeBlock
        language="ts"
        code={`import { v, ValidationError } from '@jorvel/security';
import { defineAction } from '@jorvel/runtime';

const schema = v.object({ email: v.string(), age: v.number().optional() });

export const signup = defineAction(async (input: unknown) => {
  const data = schema.parse(input);   // throws ValidationError (status 400) on bad input
  return db.insert(users).values(data);
});`}
      />
    </>
  );
}
