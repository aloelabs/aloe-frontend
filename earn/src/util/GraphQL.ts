import { arbitrum, mainnet, optimism, goerli } from '@wagmi/chains';
import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';
import { base } from 'shared/lib/data/chains/BaseChain';
import { FeeTier, GetNumericFeeTier } from 'shared/lib/data/FeeTier';

import {
  theGraphUniswapV3ArbitrumClient,
  theGraphUniswapV3BaseClient,
  theGraphUniswapV3Client,
  theGraphUniswapV3GoerliClient,
  theGraphUniswapV3OptimismClient,
} from '../App';

export function getTheGraphClient(chainId: number) {
  switch (chainId) {
    case arbitrum.id:
      return theGraphUniswapV3ArbitrumClient;
    case optimism.id:
      return theGraphUniswapV3OptimismClient;
    case base.id:
      return theGraphUniswapV3BaseClient;
    case goerli.id:
      return theGraphUniswapV3GoerliClient;
    case mainnet.id:
      return theGraphUniswapV3Client;
    default:
      throw new Error(`TheGraph endpoint is unknown for chainId ${chainId}`);
  }
}

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

export const UniswapTicksQueryWithMetadata = gql`
  query GetUniswapTicks($poolAddress: String!, $minTick: BigInt!, $maxTick: BigInt!) {
    pools(where: { id: $poolAddress }, subgraphError: allow) {
      token0 {
        decimals
      }
      token1 {
        decimals
      }
      liquidity
      tick
      ticks(first: 1000, orderBy: tickIdx, where: { tickIdx_gte: $minTick, tickIdx_lte: $maxTick }) {
        tickIdx
        liquidityNet
        price0
        price1
      }
    }
  }
`;

export const UniswapTicksQuery = gql`
  query GetUniswapTicks($poolAddress: String!, $minTick: BigInt!, $maxTick: BigInt!) {
    pools(where: { id: $poolAddress }, subgraphError: allow) {
      ticks(first: 1000, orderBy: tickIdx, where: { tickIdx_gte: $minTick, tickIdx_lte: $maxTick }) {
        tickIdx
        liquidityNet
        price0
        price1
      }
    }
  }
`;

export const Uniswap24HourPoolDataQuery = gql`
  query GetUniswap24HourPoolData($poolAddress: String!, $date: Int!) {
    poolDayDatas(first: 10, orderBy: date, where: { pool: $poolAddress, date_gt: $date }, subgraphError: allow) {
      liquidity
      feesUSD
    }
  }
`;
