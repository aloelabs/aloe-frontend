import { ethers } from 'ethers';
import { uniswapV3PoolAbi } from '../abis/UniswapV3Pool';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { convertBigNumbersForReturnContexts } from '../util/Multicall';
import { Q32 } from './constants/Values';
import { MULTICALL_ADDRESS } from './constants/ChainSpecific';

/**
 * Returns the indices for the first n levels of a binary search tree
 * @param n the number of levels to return
 * @param l the left edge of the binary search tree
 * @param r the right edge of the binary search tree
 * @param levels the levels of the binary search tree
 * @returns the indices for the first n levels of a binary search tree
 */
export function getIndicesForFirstNLevelsOfBinarySearch(
  n: number,
  l: number,
  r: number,
  levels: number[] = []
): number[] {
  if (n === 0) {
    return levels;
  }

  const mid = Math.floor((l + r) / 2);
  const midPlusOne = mid + 1;
  levels.push(mid);
  levels.push(midPlusOne);
  getIndicesForFirstNLevelsOfBinarySearch(n - 1, l, mid - 1, levels);
  getIndicesForFirstNLevelsOfBinarySearch(n - 1, mid + 1, r, levels);

  return levels;
}

async function getObservationsForIndices(
  uniswapPool: string,
  indices: number[],
  provider: ethers.providers.Provider,
  observationCardinality: number
) {
  const chainId = (await provider.getNetwork()).chainId;
  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chainId],
  });
  const calls: ContractCallContext[] = indices.map((index) => ({
    reference: index.toString(),
    contractAddress: uniswapPool,
    abi: uniswapV3PoolAbi as any,
    calls: [
      {
        reference: 'observations',
        methodName: 'observations',
        methodParameters: [index % observationCardinality],
      },
    ],
  }));

  const results = await multicall.call(calls);

  const res = Object.values(results.results).map((result) => {
    return convertBigNumbersForReturnContexts(result.callsReturnContext);
  });

  let observationCache: { [key: number]: number } = {};
  res.forEach((result) => {
    observationCache[result[0].methodParameters[0] as number] = result[0].returnValues[0] as number;
  });

  return observationCache;
}

/**
 * Returns the initial bounds for the binary search
 * @param uniswapPool the uniswap pool address
 * @param provider the ethers provider
 * @returns the initial bounds for the binary search
 */
async function getInitialBounds(uniswapPool: string, provider: ethers.providers.Provider) {
  const uniswapContract = new ethers.Contract(uniswapPool, uniswapV3PoolAbi, provider);
  const slot0 = await uniswapContract.slot0();
  const observationIndex = slot0[2];
  const observationCardinality = slot0[3];
  let left = (observationIndex + 1) % observationCardinality;
  let right = left + observationCardinality - 1;
  return {
    left,
    right,
    observationCardinality,
  };
}

/**
 * Performs a binary search to find the index of the timestamp
 * @param uniswapPool the uniswap pool address
 * @param timestamp the timestamp to search for
 * @param provider the ethers provider
 * @param observationCardinality the observation cardinality
 * @param left the left edge of the binary search tree
 * @param right the right edge of the binary search tree
 * @param initialObservationCache the initial observation cache
 * @returns the index of the timestamp closest to the given timestamp (but not greater than it)
 */
async function binarySearch(
  uniswapPool: string,
  timestamp: number,
  provider: ethers.providers.Provider,
  observationCardinality: number,
  left: number,
  right: number,
  initialObservationCache: { [key: number]: number }
) {
  let mid = 0;
  let attempt = 0;

  let observationCache = initialObservationCache;

  // We only need to do 16 attempts because the max number of observations is 2^16 - 1
  while (attempt < 16) {
    attempt++;
    if (attempt % 4 === 0) {
      // Update the cache
      const indices = getIndicesForFirstNLevelsOfBinarySearch(4, left, right);
      observationCache = await getObservationsForIndices(uniswapPool, indices, provider, observationCardinality);
    }

    mid = Math.floor((left + right) / 2);

    const midTimestampLeft = observationCache[mid % observationCardinality];
    const midTimestampRight = observationCache[(mid + 1) % observationCardinality];

    if (midTimestampLeft === timestamp) {
      // We found the exact timestamp
      return mid % observationCardinality;
    } else if (midTimestampRight === timestamp) {
      // We found the exact timestamp
      return (mid + 1) % observationCardinality;
    } else if (midTimestampLeft < timestamp && timestamp < midTimestampRight) {
      // We found the closest timestamp (take the one to the left)
      return mid % observationCardinality;
    }

    if (timestamp < midTimestampLeft) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  return mid;
}

/**
 * Computes the oracle seed for a given uniswap pool
 * @param uniswapPool the uniswap pool address
 * @param provider the ethers provider
 * @param chainId the chain id
 * @returns the oracle seed for a given uniswap pool (Q32 if it's not mainnet)
 */
export async function computeOracleSeed(uniswapPool: string, provider: ethers.providers.Provider, chainId: number) {
  // If it's not mainnet, just return Q32 as fast block times means the seed is more likely to be out of date,
  // and since L2 gas is based on calldata, there isn't much an efficiency gain anyway,
  // so we might as well do on-chain binary search
  if (chainId !== 1) {
    return Q32;
  }
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const thirtyMinutesAgo = currentTimestamp - 1800;
  const oneHourAgo = currentTimestamp - 3600;

  const { left, right, observationCardinality } = await getInitialBounds(uniswapPool, provider);

  const initialIndices = getIndicesForFirstNLevelsOfBinarySearch(4, left, right);
  const initialObservationCache = await getObservationsForIndices(
    uniswapPool,
    initialIndices,
    provider,
    observationCardinality
  );

  const thirtyMinutesAgoIndex = await binarySearch(
    uniswapPool,
    thirtyMinutesAgo,
    provider,
    observationCardinality,
    left,
    right,
    initialObservationCache
  );
  const oneHourAgoIndex = await binarySearch(
    uniswapPool,
    oneHourAgo,
    provider,
    observationCardinality,
    left,
    right,
    initialObservationCache
  );

  // The oracle seed is the concatenation of the indices (16 bits each)
  return oneHourAgoIndex * 2 ** 16 + thirtyMinutesAgoIndex;
}
