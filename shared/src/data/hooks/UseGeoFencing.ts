import { createContext, useContext } from 'react';
import { isDevelopment } from '../../util/Utils';
import { Chain } from 'wagmi';
import { GeoFencingResponse } from '../GeoFencing';

export const GeoFencingContext = createContext<GeoFencingResponse | null>(null);

export function useGeoFencing(activeChain: Chain) {
  const ctxt = useContext(GeoFencingContext);
  const isDev = isDevelopment();
  return isDev || ctxt?.isAllowed || !!activeChain.testnet;
}
