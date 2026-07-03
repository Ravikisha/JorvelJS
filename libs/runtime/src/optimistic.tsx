/**
 * @jorvel/runtime — useOptimistic
 *
 * A React-18-compatible optimistic-UI hook with the React 19 `useOptimistic`
 * shape. Show a predicted state immediately while a mutation is in flight; when
 * the real state arrives (the base `state` prop changes), the optimistic
 * overlay is dropped automatically.
 *
 * On React 19 you can use the built-in `useOptimistic`; this gives the same
 * ergonomics on 18 and degrades to it cleanly.
 */

import React from 'react';

/**
 * @param state    The authoritative state (e.g. server data).
 * @param updateFn Applies one optimistic action onto the current state.
 * @returns `[optimisticState, addOptimistic]`. Call `addOptimistic(action)`
 *          right before you kick off the async mutation; the overlay clears
 *          when `state` next changes identity (the mutation resolved).
 */
export function useOptimistic<State, Action = State>(
  state: State,
  updateFn: (currentState: State, optimisticValue: Action) => State,
): [State, (action: Action) => void] {
  const [pending, setPending] = React.useState<Action[]>([]);
  const baseRef = React.useRef(state);
  const updateRef = React.useRef(updateFn);
  React.useEffect(() => { updateRef.current = updateFn; }, [updateFn]);

  // When the authoritative state changes, the awaited mutation has landed —
  // discard the optimistic overlay so we don't double-apply it.
  React.useEffect(() => {
    if (!Object.is(baseRef.current, state)) {
      baseRef.current = state;
      setPending((p) => (p.length ? [] : p));
    }
  }, [state]);

  const addOptimistic = React.useCallback((action: Action) => {
    setPending((p) => [...p, action]);
  }, []);

  const optimisticState = pending.reduce((acc, action) => updateRef.current(acc, action), state);
  return [optimisticState, addOptimistic];
}
