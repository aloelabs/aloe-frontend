import { useCallback, useMemo, useRef, useState } from 'react';

export function useChainDependentState<S>(initialState: S | (() => S), chainId: number) {
  const [map, setMap] = useState(new Map<number, S>());

  const defaultValue = useRef(initialState instanceof Function ? initialState() : initialState);
  const currentValue = useMemo(() => (map.has(chainId) ? map.get(chainId) : defaultValue.current), [chainId, map]);

  const setValue = useCallback(
    (update: S | ((prevValue: S) => S)) => {
      setMap((prevMap) => {
        let newValue: S;
        if (update instanceof Function) {
          const prevValue = prevMap.has(chainId) ? prevMap.get(chainId) : defaultValue.current;
          newValue = update(prevValue as S);
        } else {
          newValue = update;
        }

        const newMap = new Map(prevMap);
        newMap.set(chainId, newValue);
        return newMap;
      });
    },
    [chainId]
  );

  return [currentValue, setValue] as [S, React.Dispatch<React.SetStateAction<S>>];
}
