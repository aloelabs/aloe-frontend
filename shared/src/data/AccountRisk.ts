import axios, { AxiosResponse } from 'axios';
import { Address } from 'viem';
import { API_SCREENING_URL } from './constants/Values';

export type ScreeningResponse = {
  isBlocked: boolean;
};

export type AccountRiskResult = {
  isBlocked: boolean;
  isLoading: boolean;
};

export async function screenAddress(address: Address): Promise<ScreeningResponse> {
  let response: AxiosResponse<ScreeningResponse>;
  try {
    response = await axios.get(`${API_SCREENING_URL}/${address}`);
  } catch (e) {
    return { isBlocked: true };
  }
  return response.data;
}
