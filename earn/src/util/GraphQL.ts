import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';

import { FeeTier, GetNumericFeeTier } from '../data/FeeTier';

/**
 * GraphQL query to get the uniswap volume of a pool at a given block and currently.
 * @param blockNumber the block number to use as the starting point
 * @param token0Address the address of token0 for the pool
 * @param token1Address the address of token1 for the pool
 * @param feeTier the fee tier for the pool
 * @returns
 */
export function getUniswapVolumeQuery(
  blockNumber: string | null,
  token0Address: string,
  token1Address: string,
  feeTier: FeeTier
): DocumentNode {
  return gql`
  {
    prev:pools(
      block: {number: ${blockNumber}},
      where: {
        token0: "${token0Address.toLowerCase()}",
        token1: "${token1Address.toLowerCase()}",
        feeTier: "${GetNumericFeeTier(feeTier)}"
      }
    ) {
      volumeUSD
    },
    curr:pools(
      where: {
        token0: "${token0Address.toLowerCase()}",
        token1: "${token1Address.toLowerCase()}",
        feeTier: "${GetNumericFeeTier(feeTier)}"
      }
    ) {
      volumeUSD
    }
  }
  `;
}

export const UniswapPairValueQuery = gql`
  query GetUniswapPairValue($pairAddress: String!) {
    pair(id: $pairAddress) {
      reserveUSD
      totalSupply
    }
  }
`;

export const UniswapTicksQuery = gql`
  query GetUniswapTicks($poolAddress: String!, $minTick: BigInt!, $maxTick: BigInt!) {
    pools(where: { id: $poolAddress }) {
      token0 {
        decimals
      }
      token1 {
        decimals
      }
      liquidity
      tick
      ticks(first: 1000, orderBy: tickIdx, where: { tickIdx_gt: $minTick, tickIdx_lt: $maxTick }) {
        tickIdx
        liquidityNet
        price0
        price1
      }
    }
  }
`;
