import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * A hook that returns a stateful value, and a function to update it.
 * The update function will only update the state if the component is still mounted.
 * @param initialState the initial state of the value
 * @returns a tuple containing the stateful value and the update function
 */
export default function useSafeState<S>(initialState: S | (() => S)) {
  const [state, setState] = useState(initialState);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const safeSetState = useCallback(
    (update: S | ((prevValue: S) => S)) => {
      if (isMounted.current) {
        setState(update);
      }
    },
    [setState]
  );

  return [state, safeSetState] as const;
}
