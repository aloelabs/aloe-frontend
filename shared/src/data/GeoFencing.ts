import axios from 'axios';
import { API_GEO_FENCING_URL } from './constants/Values';
import { isDappnet } from '../util/Utils';

export type GeoFencingResponse = {
  isAllowed: boolean;
};

export type GeoFencingInfo = GeoFencingResponse & {
  isLoading: boolean;
};

export async function fetchGeoFencing(): Promise<GeoFencingResponse> {
  if (isDappnet()) {
    return {
      isAllowed: true,
    };
  }
  try {
    return (await axios.get(API_GEO_FENCING_URL)).data;
  } catch (error) {
    console.error(error);
    return {
      isAllowed: false,
    };
  }
}
