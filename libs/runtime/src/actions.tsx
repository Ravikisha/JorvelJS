/**
 * @jorvel/runtime — server actions (the MUTATION primitive)
 *
 * Symmetric counterpart to the READ-side loader (`defineLoader` /
 * `useLoaderData` in `@jorvel/ssr`):
 *   - `defineLoader` (in `@jorvel/ssr`) — typed read, SSR + hydration ready.
 *   - `defineAction` (here)             — typed mutation ("server action").
 *                       Pairs with `useAction` for pending/error/result state,
 *                       and binds directly to a `<form>` via `useFormAction`.
 *
 * An action is a plain async function you can call anywhere; the React hooks add
 * the pending/error/data state machine expected of React 19 form actions.
 */

import React from 'react';

// ── Actions (mutations) ──────────────────────────────────────────────────────

export interface ActionContext {
  request?: Request;
  signal?: AbortSignal;
}

export type Action<Input, Output> = (
  input: Input,
  ctx?: ActionContext,
) => Promise<Output> | Output;

/** Identity wrapper that pins an action's input/output types for inference. */
export function defineAction<Input, Output>(
  fn: Action<Input, Output>,
): Action<Input, Output> {
  return fn;
}

// ── useAction ────────────────────────────────────────────────────────────────

export interface ActionState<Input, Output> {
  /** Last successful result, or null before the first success. */
  data: Output | null;
  /** Error from the last failed run, or null. */
  error: unknown;
  /** True while a submission is in flight. */
  pending: boolean;
  /** Run the action. Resolves to the result or throws on failure. */
  submit: (input: Input) => Promise<Output>;
  /** Clear data/error/pending back to the initial state. */
  reset: () => void;
}

/**
 * Drive a {@link defineAction} action with React state. Concurrent submissions
 * are serialized to "last wins": only the most recent `submit` updates state,
 * so a slow earlier request can't clobber a newer result.
 */
export function useAction<Input, Output>(
  action: Action<Input, Output>,
): ActionState<Input, Output> {
  const [data, setData] = React.useState<Output | null>(null);
  const [error, setError] = React.useState<unknown>(null);
  const [pending, setPending] = React.useState(false);

  const actionRef = React.useRef(action);
  React.useEffect(() => { actionRef.current = action; }, [action]);

  // Monotonic run id + mount flag guard against state updates from a stale or
  // post-unmount submission.
  const runId = React.useRef(0);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const submit = React.useCallback(async (input: Input): Promise<Output> => {
    const id = ++runId.current;
    if (mounted.current) {
      setPending(true);
      setError(null);
    }
    try {
      const result = await actionRef.current(input);
      if (mounted.current && id === runId.current) {
        setData(result);
        setPending(false);
      }
      return result;
    } catch (e) {
      if (mounted.current && id === runId.current) {
        setError(e);
        setPending(false);
      }
      throw e;
    }
  }, []);

  const reset = React.useCallback(() => {
    runId.current++; // invalidate any in-flight submission
    if (mounted.current) {
      setData(null);
      setError(null);
      setPending(false);
    }
  }, []);

  return { data, error, pending, submit, reset };
}

// ── useFormAction ─────────────────────────────────────────────────────────

export interface FormActionState<Output> extends Omit<ActionState<FormData, Output>, 'submit'> {
  /** Attach to `<form onSubmit={onSubmit}>` — calls preventDefault + submits FormData. */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  /** Submit a FormData payload imperatively. */
  submit: (input: FormData) => Promise<Output>;
}

export interface CsrfConfig {
  /** Token value to echo back (from `issueCsrfToken` in @jorvel/security). */
  token: string;
  /** Hidden field name. Default `_csrf` — match `csrfFieldName()`. */
  field?: string;
}

/**
 * Progressive-enhancement helper: binds a `FormData` action to a `<form>`.
 * Without JS the form posts natively (wire the same action server-side); with
 * JS this intercepts submit, runs the action, and exposes pending/error/data.
 */
export function useFormAction<Output>(
  action: Action<FormData, Output>,
): FormActionState<Output> {
  const state = useAction(action);
  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void state.submit(new FormData(event.currentTarget)).catch(() => {
        // error is captured in state.error; swallow to avoid unhandled rejection
      });
    },
    [state],
  );
  return { ...state, onSubmit };
}

// ── <Form> ──────────────────────────────────────────────────────────────────

export interface FormProps<Output>
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'action' | 'children'> {
  /** The mutation to run on submit. Receives the form's FormData. */
  action: Action<FormData, Output>;
  /** Inject a hidden CSRF field. Pair with `issueCsrfToken` / `verifyCsrf`. */
  csrf?: CsrfConfig;
  /** Native POST target — used as the no-JS fallback. */
  formAction?: string;
  /** Static children, or a render fn given the live form-action state. */
  children?: React.ReactNode | ((state: FormActionState<Output>) => React.ReactNode);
}

/**
 * Progressive-enhancement form bound to a {@link defineAction}. Renders a real
 * `<form>` (native POST without JS when `formAction` is set), intercepts submit
 * with JS, and injects a hidden CSRF field when `csrf` is provided. Pass a
 * render-fn child to read `{ pending, error, data, reset }`.
 */
export function Form<Output>({
  action,
  csrf,
  formAction,
  children,
  ...formProps
}: FormProps<Output>): React.ReactElement {
  const state = useFormAction(action);
  return (
    <form
      {...formProps}
      {...(formAction ? { action: formAction, method: 'post' } : {})}
      onSubmit={state.onSubmit}
    >
      {csrf ? <input type="hidden" name={csrf.field ?? '_csrf'} value={csrf.token} /> : null}
      {typeof children === 'function' ? children(state) : children}
    </form>
  );
}
