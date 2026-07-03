import { CodeBlock } from '@/components/site/code-block';

export const metadata = {
  title: '@jorvel/ui API',
  description: 'Headless-ish React primitives: Button, Input, Card, Modal, Toast, ThemeProvider.',
};

export default function UiApi() {
  return (
    <>
      <h1>@jorvel/ui</h1>
      <p>Small, unstyled-by-default React components + a theme context, safe to share across remotes.</p>

      <h2 id="components">Components</h2>
      <CodeBlock
        language="tsx"
        code={`import { Button, Input, Card, Modal, ToastProvider, useToast } from '@jorvel/ui';

<Button variant="primary" onClick={...}>Save</Button>
<Input value={v} onChange={setV} />
<Card>…</Card>
<Modal open={open} onClose={close}>…</Modal>

// toasts
<ToastProvider>…</ToastProvider>
const toast = useToast();  toast.show({ variant: 'success', message: 'Saved' });`}
      />

      <h2 id="theme">Theme</h2>
      <CodeBlock
        language="tsx"
        code={`import { ThemeProvider, useTheme, defaultTheme } from '@jorvel/ui';

<ThemeProvider theme={defaultTheme}>…</ThemeProvider>
const theme = useTheme();   // tokens; drives component styling + CSS variables`}
      />
      <p>
        Types: <code>ButtonProps</code>, <code>InputProps</code>, <code>ModalProps</code>,{' '}
        <code>CardProps</code>, <code>ToastOptions</code>, <code>Theme</code>. Pair with the{' '}
        <a href="/docs/recipes#design-tokens">design-token recipe</a> for cross-remote theming.
      </p>
    </>
  );
}
