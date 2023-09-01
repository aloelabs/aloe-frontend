import { ethers } from 'ethers';
import { UniswapV3PoolABI } from '../abis/UniswapV3Pool';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { convertBigNumbersForReturnContexts } from '../util/Multicall';
import { Q32 } from './constants/Values';

/**
 * Returns the first n levels of a binary search tree
 * @param n the number of levels to return
 * @param l the left edge of the binary search tree
 * @param r the right edge of the binary search tree
 * @param levels the levels of the binary search tree
 * @returns the first n levels of a binary search tree
 */
export function getFirstNLevelsOfBinarySearchTree(n: number, l: number, r: number, levels: number[] = []): number[] {
  if (n === 0) {
    return levels;
  }

  const mid = Math.floor((l + r) / 2);
  const midPlusOne = mid + 1;
  levels.push(mid);
  levels.push(midPlusOne);
  getFirstNLevelsOfBinarySearchTree(n - 1, l, mid - 1, levels);
  getFirstNLevelsOfBinarySearchTree(n - 1, mid + 1, r, levels);

  return levels;
}

async function getObservationsForIndices(
  uniswapPool: string,
  indices: number[],
  provider: ethers.providers.Provider,
  observationCardinality: number
) {
  const multicall = new Multicall({ ethersProvider: provider });
  const calls: ContractCallContext[] = indices.map((level) => ({
    reference: level.toString(),
    contractAddress: uniswapPool,
    abi: UniswapV3PoolABI as any,
    calls: [
      {
        reference: 'observations',
        methodName: 'observations',
        methodParameters: [level % observationCardinality],
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

async function getInitialBounds(uniswapPool: string, provider: ethers.providers.Provider) {
  const uniswapContract = new ethers.Contract(uniswapPool, UniswapV3PoolABI, provider);
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

  while (attempt < 16) {
    attempt++;
    if (attempt % 5 === 0) {
      // Update the cache
      const indices = getFirstNLevelsOfBinarySearchTree(5, left, right);
      observationCache = await getObservationsForIndices(uniswapPool, indices, provider, observationCardinality);
    }

    mid = Math.floor((left + right) / 2);

    // Turn it back into in terms of ring buffer
    const midTimestampLeft = observationCache[mid % observationCardinality];
    const midTimestampRight = observationCache[(mid + 1) % observationCardinality];

    if (midTimestampLeft === timestamp) {
      return mid % observationCardinality;
    } else if (midTimestampRight === timestamp) {
      return (mid + 1) % observationCardinality;
    } else if (midTimestampLeft < timestamp && timestamp < midTimestampRight) {
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

export async function computeOracleSeed(uniswapPool: string, provider: ethers.providers.Provider, chainId: number) {
  // If it's not mainnet, just return Q32
  if (chainId !== 1) {
    return Q32;
  }
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const thirtyMinutesAgo = currentTimestamp - 1800;
  const oneHourAgo = currentTimestamp - 3600;

  const { left, right, observationCardinality } = await getInitialBounds(uniswapPool, provider);

  const initialIndices = getFirstNLevelsOfBinarySearchTree(5, left, right);
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
  return oneHourAgoIndex * 2 ** 16 + thirtyMinutesAgoIndex;
}
