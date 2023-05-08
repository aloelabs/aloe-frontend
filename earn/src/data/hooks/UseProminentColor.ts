import { useEffect, useState } from 'react';

import { getProminentColor } from '../../util/Colors';

export default function useProminentColor(iconPath: string) {
  const [prominentColor, setProminentColor] = useState<string>('0, 0, 0');
  useEffect(() => {
    let mounted = true;
    async function computeProminentColor() {
      const computedProminentColor = await getProminentColor(iconPath);
      if (mounted) {
        setProminentColor(computedProminentColor);
      }
    }
    computeProminentColor();
    return () => {
      mounted = false;
    };
  }, [iconPath]);
  return prominentColor;
}
