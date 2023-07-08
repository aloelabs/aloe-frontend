import { DependencyList, EffectCallback, useEffect } from 'react';

/**
 * A debounced useEffect hook.
 * @param effect the effect to be debounced
 * @param delayMs the delay in milliseconds
 * @param deps the dependencies of the effect
 */
export function useDebouncedEffect(effect: EffectCallback, delayMs: number, deps?: DependencyList): void {
  useEffect(() => {
    const timeoutId = setTimeout(effect, delayMs);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...(deps || []), delayMs]);
}
