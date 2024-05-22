import { useEffect, useState } from 'react';

import { getProminentColor } from 'shared/lib/util/Colors';

// TODO: deprecate this in favor of useTokenColors
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
