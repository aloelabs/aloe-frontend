import { useEffect } from 'react';

export default function useHover(
  ref: React.RefObject<HTMLElement>,
  onHover: (e?: MouseEvent) => void,
  onLeave: (e?: MouseEvent) => void
) {
  useEffect(() => {
    const node = ref.current;
    if (node) {
      node.addEventListener('mouseenter', onHover);
      node.addEventListener('mouseleave', onLeave);

      return () => {
        node.removeEventListener('mouseenter', onHover);
        node.removeEventListener('mouseleave', onLeave);
      };
    }
  }, [ref, onHover, onLeave]);
}
