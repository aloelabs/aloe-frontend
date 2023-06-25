import { useEffect } from 'react';

export default function useEffectOnce(func: () => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(func, []);
}
