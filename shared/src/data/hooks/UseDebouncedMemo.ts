import { DependencyList, useEffect, useRef, useState } from 'react';

export function useDebouncedMemo<T>(factory: () => T, deps: DependencyList, delay: number): T {
  const [state, setState] = useState<T>(() => factory());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setTimeout(() => {
      const value = factory();
      setState(value);
      timerRef.current = null;
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
