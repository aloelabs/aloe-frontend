import { ApolloQueryResult } from '@apollo/react-hooks';
import { defaultAbiCoder } from '@ethersproject/abi';
import { getCreate2Address } from '@ethersproject/address';
import { keccak256 } from '@ethersproject/solidity';
import { TickMath } from '@uniswap/v3-sdk';
import { Chain, Provider } from '@wagmi/core';
import Big from 'big.js';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { CallContext, CallReturnContext } from 'ethereum-multicall/dist/esm/models';
import { BigNumber, ethers } from 'ethers';
import JSBI from 'jsbi';
import {
  MULTICALL_ADDRESS,
  UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { Token } from 'shared/lib/data/Token';
import { getToken } from 'shared/lib/data/TokenData';
import { toBig } from 'shared/lib/util/Numbers';
import { Address } from 'wagmi';
import { arbitrum, optimism, mainnet, goerli } from 'wagmi/chains';

import {
  theGraphUniswapV3ArbitrumClient,
  theGraphUniswapV3Client,
  theGraphUniswapV3GoerliClient,
  theGraphUniswapV3OptimismClient,
} from '../App';
import UniswapNFTManagerABI from '../assets/abis/UniswapNFTManager.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { UniswapTicksQuery, UniswapTicksQueryWithMetadata } from '../util/GraphQL';
import { convertBigNumbersForReturnContexts } from '../util/Multicall';
import { BIGQ96, Q96 } from './constants/Values';

const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const POOL_INIT_CODE_HASH = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';
const MAX_TICKS_PER_QUERY = 1000;

export type UniswapPosition = {
  lower: number;
  upper: number;
  liquidity: JSBI;
};

export type UniswapPositionPrior = Omit<UniswapPosition, 'liquidity'>;

export type UniswapNFTPosition = {
  operator: string;
  token0: Token;
  token1: Token;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: JSBI;
};

export type UniswapNFTPositionEntry = [number, UniswapNFTPosition];

export interface UniswapV3PoolSlot0 {
  sqrtPriceX96: ethers.BigNumber;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
}

export interface UniswapV3PoolBasics {
  slot0: UniswapV3PoolSlot0;
  tickSpacing: number;
  token1OverToken0: Big;
}

export type TickData = {
  tick: number;
  liquidity: Big;
  price1In0: number;
  price0In1: number;
};

export type UniswapV3GraphQLTick = {
  tickIdx: string;
  liquidityNet: string;
  price0: string;
  price1: string;
  __typename: string;
};

export type UniswapV3GraphQLTicksQueryResponse = {
  pools: {
    token0: { decimals: string };
    token1: { decimals: string };
    liquidity: string;
    tick: string;
    ticks: UniswapV3GraphQLTick[];
    __typename: string;
  }[];
};

function getAmount0ForLiquidity(sqrtRatioAX96: JSBI, sqrtRatioBX96: JSBI, liquidity: JSBI): JSBI {
  const res = JSBI.BigInt(96);
  const numerator = JSBI.multiply(JSBI.leftShift(liquidity, res), JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96));
  const denominator = JSBI.multiply(sqrtRatioBX96, sqrtRatioAX96);
  return JSBI.divide(numerator, denominator);
}

function getAmount1ForLiquidity(sqrtRatioAX96: JSBI, sqrtRatioBX96: JSBI, liquidity: JSBI): JSBI {
  const numerator = JSBI.multiply(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96));
  return JSBI.divide(numerator, JSBI.BigInt(Q96.toString()));
}

export function getAmountsForLiquidity(
  position: UniswapPosition,
  currentTick: number,
  token0Decimals: number,
  token1Decimals: number
): [number, number] {
  let lowerTick = position.lower;
  let upperTick = position.upper;
  const liquidity = position.liquidity;

  if (lowerTick > upperTick) [lowerTick, upperTick] = [upperTick, lowerTick];

  //lower price
  const sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(lowerTick);
  //upper price
  const sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(upperTick);
  //current price
  const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(currentTick);

  let amount0 = JSBI.BigInt(0);
  let amount1 = JSBI.BigInt(0);

  if (currentTick <= lowerTick) {
    amount0 = getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
  } else if (currentTick < upperTick) {
    amount0 = getAmount0ForLiquidity(sqrtRatioX96, sqrtRatioBX96, liquidity);
    amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioX96, liquidity);
  } else {
    amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
  }

  return [
    new Big(amount0.toString(10)).div(10 ** token0Decimals).toNumber(),
    new Big(amount1.toString(10)).div(10 ** token1Decimals).toNumber(),
  ];
}

export function getValueOfLiquidity(position: UniswapPosition, currentTick: number, token1Decimals: number): number {
  let lowerTick = position.lower;
  let upperTick = position.upper;
  const liquidity = position.liquidity;

  if (lowerTick > upperTick) [lowerTick, upperTick] = [upperTick, lowerTick];

  //lower price
  const sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(lowerTick);
  //upper price
  const sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(upperTick);
  //current price
  const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(currentTick);

  let value0 = JSBI.BigInt(0);
  let value1 = JSBI.BigInt(0);

  const jsbiQ96 = JSBI.BigInt(Q96.toString());
  const res = JSBI.BigInt(96);

  if (currentTick <= lowerTick) {
    const priceX96 = JSBI.divide(JSBI.multiply(sqrtRatioX96, sqrtRatioX96), jsbiQ96);

    const numerator = JSBI.multiply(JSBI.leftShift(liquidity, res), JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96));
    const temp = JSBI.divide(numerator, sqrtRatioBX96);
    value0 = JSBI.divide(JSBI.multiply(priceX96, temp), JSBI.leftShift(sqrtRatioAX96, res));
  } else if (currentTick < upperTick) {
    //mulDiv(sqrtRatioX96, sqrtRatioBX96 - sqrtRatioX96, FixedPoint96.Q96)
    const numerator = JSBI.divide(JSBI.multiply(sqrtRatioX96, JSBI.subtract(sqrtRatioBX96, sqrtRatioX96)), jsbiQ96);
    value0 = JSBI.divide(JSBI.multiply(liquidity, numerator), sqrtRatioBX96);
    value1 = JSBI.divide(JSBI.multiply(liquidity, JSBI.subtract(sqrtRatioX96, sqrtRatioAX96)), jsbiQ96);
  } else {
    value1 = JSBI.divide(JSBI.multiply(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)), jsbiQ96);
  }

  const value = JSBI.add(value0, value1);

  return new Big(value.toString(10)).div(10 ** token1Decimals).toNumber();
}

export function uniswapPositionKey(owner: string, lower: number, upper: number): string {
  return ethers.utils.solidityKeccak256(['address', 'int24', 'int24'], [owner, lower, upper]);
}

export function convertSqrtPriceX96(sqrtPriceX96: ethers.BigNumber): Big {
  const priceX96 = sqrtPriceX96.mul(sqrtPriceX96).div(Q96);
  return toBig(priceX96).div(BIGQ96);
}

export function tickToPrice(
  tick: number,
  token0Decimals: number,
  token1Decimals: number,
  isInTermsOfToken0 = true
): number {
  const sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick);
  const priceX192 = JSBI.multiply(sqrtPriceX96, sqrtPriceX96);
  const priceX96 = JSBI.signedRightShift(priceX192, JSBI.BigInt(96));

  const priceX96Big = new Big(priceX96.toString(10));

  const decimalDiff = token0Decimals - token1Decimals;
  const price0In1 = priceX96Big
    .mul(10 ** decimalDiff)
    .div(BIGQ96)
    .toNumber();
  const price1In0 = 1.0 / price0In1;
  return isInTermsOfToken0 ? price0In1 : price1In0;
}

export async function fetchUniswapPositions(
  priors: UniswapPositionPrior[],
  marginAccountAddress: string,
  uniswapV3PoolAddress: string,
  provider: Provider,
  chain: Chain
) {
  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chain.id],
  });
  const keys = priors.map((prior) => uniswapPositionKey(marginAccountAddress, prior.lower!, prior.upper!));
  const contractCallContext: ContractCallContext[] = [];
  keys.forEach((key) => {
    contractCallContext.push({
      reference: key,
      contractAddress: uniswapV3PoolAddress,
      abi: UniswapV3PoolABI,
      calls: [
        {
          reference: 'positions',
          methodName: 'positions',
          methodParameters: [key],
        },
      ],
    });
  });
  const results = (await multicall.call(contractCallContext)).results;
  const updatedReturnContexts: CallReturnContext[][] = [];
  for (const key in results) {
    updatedReturnContexts.push(convertBigNumbersForReturnContexts(results[key].callsReturnContext));
  }

  const fetchedUniswapPositions = new Map<string, UniswapPosition>();
  priors.forEach((prior, i) => {
    const liquidity = JSBI.BigInt(updatedReturnContexts[i][0].returnValues[0].toString());
    fetchedUniswapPositions.set(keys[i], { ...prior, liquidity: liquidity });
  });

  return fetchedUniswapPositions;
}

/**
 *
 * @returns the current tick for a given Uniswap pool
 */
export async function fetchUniswapPoolBasics(
  uniswapPoolAddress: string,
  provider: ethers.providers.BaseProvider
): Promise<UniswapV3PoolBasics> {
  const chainId = (await provider.getNetwork()).chainId;
  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chainId],
  });
  const contractCallContext: ContractCallContext[] = [
    {
      reference: 'uniswapV3Pool',
      contractAddress: uniswapPoolAddress,
      abi: UniswapV3PoolABI,
      calls: [
        { reference: 'slot0', methodName: 'slot0', methodParameters: [] },
        { reference: 'tickSpacing', methodName: 'tickSpacing', methodParameters: [] },
      ],
    },
  ];

  const results = (await multicall.call(contractCallContext)).results;
  const updatedReturnContext = convertBigNumbersForReturnContexts(results['uniswapV3Pool'].callsReturnContext);
  const slot0 = updatedReturnContext[0].returnValues;
  const tickSpacing = updatedReturnContext[1].returnValues;

  return {
    slot0: {
      sqrtPriceX96: slot0[0],
      tick: slot0[1],
      observationIndex: slot0[2],
      observationCardinality: slot0[3],
      observationCardinalityNext: slot0[4],
      feeProtocol: slot0[5],
    },
    tickSpacing: tickSpacing[0],
    token1OverToken0: convertSqrtPriceX96(slot0[0]),
  };
}

export async function fetchUniswapNFTPositions(
  userAddress: string,
  provider: Provider
): Promise<Map<number, UniswapNFTPosition>> {
  const chainId = (await provider.getNetwork()).chainId;
  const nftManager = new ethers.Contract(
    UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId],
    UniswapNFTManagerABI,
    provider
  );
  const numPositions: BigNumber = await nftManager.balanceOf(userAddress);
  if (numPositions.isZero()) {
    return new Map();
  }
  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chainId],
  });
  const tokenIdCallContexts: CallContext[] = [];
  for (let i = 0; i < numPositions.toNumber(); i++) {
    tokenIdCallContexts.push({
      reference: `tokenOfOwnerByIndex-${i}`,
      methodName: 'tokenOfOwnerByIndex',
      methodParameters: [userAddress, i],
    });
  }
  const tokenIdCallContext: ContractCallContext[] = [
    {
      reference: 'uniswapNFTManager',
      contractAddress: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId],
      abi: UniswapNFTManagerABI,
      calls: tokenIdCallContexts,
    },
  ];
  const tokenIdResults = (await multicall.call(tokenIdCallContext)).results['uniswapNFTManager'];
  const tokenIdReturnContexts = convertBigNumbersForReturnContexts(tokenIdResults.callsReturnContext);
  const tokenIds = tokenIdReturnContexts.map((context) => context.returnValues[0].toNumber());

  const positionsCallContexts: CallContext[] = [];
  for (let i = 0; i < tokenIds.length; i++) {
    positionsCallContexts.push({
      reference: `positions-${tokenIds[i]}}`,
      methodName: 'positions',
      methodParameters: [tokenIds[i]],
    });
  }
  const positionsCallContext: ContractCallContext[] = [
    {
      reference: 'uniswapNFTManager',
      contractAddress: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId],
      abi: UniswapNFTManagerABI,
      calls: positionsCallContexts,
    },
  ];
  const positionsResults = (await multicall.call(positionsCallContext)).results['uniswapNFTManager'];
  const callsReturnContext = convertBigNumbersForReturnContexts(positionsResults.callsReturnContext);
  const result: Map<number, UniswapNFTPosition> = new Map();

  for (let i = 0; i < tokenIds.length; i++) {
    const position = callsReturnContext[i].returnValues;
    const uniswapPosition: UniswapNFTPosition = {
      operator: position[1],
      token0: getToken(chainId, position[2]),
      token1: getToken(chainId, position[3]),
      fee: position[4],
      tickLower: position[5],
      tickUpper: position[6],
      liquidity: JSBI.BigInt(position[7].toString()),
    };
    result.set(tokenIds[i], uniswapPosition);
  }
  return result;
}

async function fetchTickData(poolAddress: string, chainId: number, minTick?: number, maxTick?: number) {
  if (minTick === undefined) minTick = TickMath.MIN_TICK;
  if (maxTick === undefined) maxTick = TickMath.MAX_TICK;

  let theGraphClient = theGraphUniswapV3Client;
  switch (chainId) {
    case arbitrum.id:
      theGraphClient = theGraphUniswapV3ArbitrumClient;
      break;
    case optimism.id:
      theGraphClient = theGraphUniswapV3OptimismClient;
      break;
    case goerli.id:
      theGraphClient = theGraphUniswapV3GoerliClient;
      break;
    case mainnet.id:
      break;
    default:
      throw new Error(`TheGraph endpoint is unknown for chainId ${chainId}`);
  }

  const initialQueryResponse = (await theGraphClient.query({
    query: UniswapTicksQueryWithMetadata,
    variables: {
      poolAddress: poolAddress.toLowerCase(),
      minTick: minTick,
      maxTick: maxTick,
    },
  })) as ApolloQueryResult<UniswapV3GraphQLTicksQueryResponse>;
  if (!initialQueryResponse.data.pools) return null;

  const poolLiquidityData = initialQueryResponse.data.pools[0];
  const tickData = poolLiquidityData.ticks.concat();

  while (true) {
    const queryResponse = (await theGraphClient.query({
      query: UniswapTicksQuery,
      variables: {
        poolAddress: poolAddress.toLowerCase(),
        minTick: Number(tickData[tickData.length - 1].tickIdx),
        maxTick: maxTick,
      },
    })) as ApolloQueryResult<UniswapV3GraphQLTicksQueryResponse>;
    if (!queryResponse.data.pools) break;

    tickData.push(...queryResponse.data.pools[0].ticks);
    if (queryResponse.data.pools[0].ticks.length < MAX_TICKS_PER_QUERY) break;
  }

  return {
    ...poolLiquidityData,
    ticks: tickData,
  };
}

export async function calculateTickData(poolAddress: string, chainId: number): Promise<TickData[]> {
  const poolLiquidityData = await fetchTickData(poolAddress, chainId);
  if (poolLiquidityData === null) return [];

  const token0Decimals = Number(poolLiquidityData.token0.decimals);
  const token1Decimals = Number(poolLiquidityData.token1.decimals);
  const decimalFactor = new Big(10 ** (token1Decimals - token0Decimals));
  const rawTicksData = poolLiquidityData.ticks;

  const tickData: TickData[] = [];

  let liquidity = JSBI.BigInt('0');

  for (const element of rawTicksData) {
    const tick = Number(element.tickIdx);
    const liquidityNet = JSBI.BigInt(element.liquidityNet);
    const price0 = new Big(element.price0);
    const price1 = new Big(element.price1);

    liquidity = JSBI.ADD(liquidity, liquidityNet);

    tickData.push({
      tick,
      liquidity: new Big(liquidity.toString(10)),
      price1In0: price1.mul(decimalFactor).toNumber(),
      price0In1: price0.div(decimalFactor).toNumber(),
    });
  }

  return tickData;
}

function modQ24(value: number) {
  return value & 0b00000000111111111111111111111111;
}

export function zip(uniswapPositions: readonly UniswapPosition[]) {
  const positions: number[] = [];
  uniswapPositions.forEach((position) => {
    if (!JSBI.EQ(position.liquidity, JSBI.BigInt(0))) {
      positions.push(position.lower);
      positions.push(position.upper);
    }
  });
  while (positions.length < 6) {
    positions.push(0xdead);
  }

  const Q24 = 1 << 24;
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] >= 0) continue;
    positions[i] = modQ24(Q24 + positions[i]);
  }

  const zipped = positions.reduce((prev, curr, i) => {
    return JSBI.add(prev, JSBI.leftShift(JSBI.BigInt(curr), JSBI.BigInt(24 * i)));
  }, JSBI.BigInt(0));

  return zipped.toString(10);
}

export function computePoolAddress({ token0, token1, fee }: { token0: Token; token1: Token; fee: number }): Address {
  return getCreate2Address(
    FACTORY_ADDRESS,
    keccak256(
      ['bytes'],
      [defaultAbiCoder.encode(['address', 'address', 'uint24'], [token0.address, token1.address, fee])]
    ),
    POOL_INIT_CODE_HASH
  ) as Address;
}
