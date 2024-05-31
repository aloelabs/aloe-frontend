import { useEffect, useState } from 'react';

export default function useMediaQuery(minWidth: number) {
  const [isMinWidth, setIsMinWidth] = useState(window.innerWidth > minWidth);

  useEffect(() => {
    const handleResize = () => {
      setIsMinWidth(window.innerWidth > minWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [minWidth]);

  return isMinWidth;
}

export function useMediaQuery2() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setWidth(Math.ceil(window.innerWidth / 10) * 10);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return width;
}
