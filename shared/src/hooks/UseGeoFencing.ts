import { createContext, useContext } from 'react';
import { isDevelopment } from '../util/Utils';
import { GeoFencingInfo } from '../data/GeoFencing';

export const GeoFencingContext = createContext<GeoFencingInfo>({
  isAllowed: false,
  isLoading: true,
});

export function useGeoFencing() {
  const ctxt = useContext(GeoFencingContext);
  const isDev = isDevelopment();
  return { isAllowed: isDev || ctxt.isAllowed, isLoading: ctxt.isLoading };
}
