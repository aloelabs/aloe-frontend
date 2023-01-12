import { RefObject, useEffect } from 'react';

export default function useClickOutside(
  ref: RefObject<HTMLDivElement>,
  handler: () => void,
  shouldHandleClick: boolean = true
) {
  useEffect(() => {
    function listener(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    }
    if (shouldHandleClick) {
      document.addEventListener('mousedown', listener);
    }
    return () => {
      document.removeEventListener('mousedown', listener);
    };
  }, [handler, ref, shouldHandleClick]);
}
