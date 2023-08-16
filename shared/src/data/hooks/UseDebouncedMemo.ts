import { DependencyList, Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';

export function useDebouncedMemo<T>(factory: () => T, deps: DependencyList, delay: number): T {
  const [state, setState] = useState(factory);
  const callback = useMemo(() => debounce(setState, delay), [delay]);

  useEffect(() => {
    callback(factory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

function debounce<T>(setState: Dispatch<SetStateAction<T>>, delay: number): (value: T) => void {
  let timer: NodeJS.Timeout | undefined;

  return (value: T) => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      setState(value);
    }, delay);
  };
}
