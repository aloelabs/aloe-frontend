export default function useLockScroll(): { lockScroll: () => void; unlockScroll: () => void } {
  const lockScroll = () => {
    document.body.style.overflow = 'hidden';
  };
  const unlockScroll = () => {
    document.body.style.overflow = 'auto';
  };
  return { lockScroll, unlockScroll };
}
