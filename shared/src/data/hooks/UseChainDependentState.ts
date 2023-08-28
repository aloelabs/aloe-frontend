import { useCallback, useMemo, useRef } from 'react';
import useSafeState from './UseSafeState';

export function useChainDependentState<S>(initialState: S | (() => S), chainId: number) {
  const [map, setMap] = useSafeState(new Map<number, S>());

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
    [chainId, setMap]
  );

  return [currentValue, setValue] as [S, React.Dispatch<React.SetStateAction<S>>];
}
