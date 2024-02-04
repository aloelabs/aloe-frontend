import { createContext, useContext } from 'react';
import { isDevelopment } from '../../util/Utils';
import { Chain } from 'wagmi';
import { GeoFencingInfo } from '../GeoFencing';

export const GeoFencingContext = createContext<GeoFencingInfo>({
  isAllowed: false,
  isLoading: true,
});

export function useGeoFencing(activeChain: Chain) {
  const ctxt = useContext(GeoFencingContext);
  const isDev = isDevelopment();
  return { isAllowed: isDev || ctxt.isAllowed || Boolean(activeChain.testnet), isLoading: ctxt.isLoading };
}
