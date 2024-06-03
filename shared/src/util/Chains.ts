import { Chain } from 'viem';
import { DEFAULT_ETHERSCAN_URL } from '../data/constants/Values';

/**
 * Get the Etherscan url for a given chain
 * @param chain the chain to get the Etherscan url for
 * @returns the Etherscan url for the given chain
 */
export function getBlockExplorerUrl(chain: Chain): string {
  return chain.blockExplorers?.default.url ?? DEFAULT_ETHERSCAN_URL;
}
