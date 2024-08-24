import { defaultAbiCoder } from '@ethersproject/abi';
import { getCreate2Address } from '@ethersproject/address';
import { keccak256 } from '@ethersproject/solidity';
import { TickMath } from '@uniswap/v3-sdk';
import Big from 'big.js';
import { ContractCallContext, Multicall, CallReturnContext } from 'ethereum-multicall';
import { BigNumber, ethers } from 'ethers';
import JSBI from 'jsbi';
import { uniswapNonFungiblePositionsAbi } from '../abis/UniswapNonFungiblePositions';
import { uniswapV3PoolAbi } from '../abis/UniswapV3Pool';
import {
  getChainName,
  MULTICALL_ADDRESS,
  UNISWAP_FACTORY_ADDRESS,
  UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
} from './constants/ChainSpecific';
import { Token } from './Token';
import { getToken } from './TokenData';
import { toBig } from '../util/Numbers';
import { Address, Chain, Hex } from 'viem';

import { BIGQ96, Q96 } from './constants/Values';
import { CallContext } from 'ethereum-multicall/dist/esm/models';
import { LiquidityChartV2, PoolFees } from '@gfxlabs/oku';

const TOTAL_NUM_TICKS = 20000;

async function okuFetch(chainId: number, subPath: string, params: (string | number)[]) {
  const response = await fetch(`https://omni.icarus.tools/${getChainName(chainId)}/cush/${subPath}`, {
    method: 'POST',
    body: JSON.stringify({
      params: params,
    }),
  });
  return response.json();
}

function convertBigNumbersForReturnContexts(callReturnContexts: CallReturnContext[]): CallReturnContext[] {
  return callReturnContexts.map((callReturnContext) => {
    callReturnContext.returnValues = callReturnContext.returnValues.map((returnValue) => {
      // If the return value is a BigNumber, convert it to an ethers BigNumber
      if (returnValue?.type === 'BigNumber' && returnValue?.hex) {
        returnValue = BigNumber.from(returnValue.hex);
      }
      return returnValue;
    });
    return callReturnContext;
  });
}

const POOL_INIT_CODE_HASH = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';

export type UniswapPosition = {
  lower: number;
  upper: number;
  liquidity: JSBI;
};

export type UniswapPositionPrior = Omit<UniswapPosition, 'liquidity'>;

export type UniswapNFTPosition = UniswapPosition & {
  owner: Address;
  operator: string;
  token0: Token;
  token1: Token;
  fee: number;
  tokenId: number;
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
  liquidityDensity: number;
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

export type UniswapV3GraphQL24HourPoolDataQueryResponse = {
  poolDayDatas: {
    liquidity: string;
    feesUSD: string;
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

export function getAmountsForLiquidityGN(position: UniswapPosition, sqrtRatioX96: JSBI) {
  const sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(position.lower);
  const sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(position.upper);
  const liquidity = position.liquidity;

  let amount0 = JSBI.BigInt(0);
  let amount1 = JSBI.BigInt(0);

  if (JSBI.LE(sqrtRatioX96, sqrtRatioAX96)) {
    amount0 = getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
  } else if (JSBI.LT(sqrtRatioX96, sqrtRatioBX96)) {
    amount0 = getAmount0ForLiquidity(sqrtRatioX96, sqrtRatioBX96, liquidity);
    amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioX96, liquidity);
  } else {
    amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
  }

  return { amount0, amount1 };
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
  provider: ethers.providers.JsonRpcProvider,
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
      abi: uniswapV3PoolAbi as any,
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
      abi: uniswapV3PoolAbi as any,
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

export async function fetchUniswapNFTPosition(
  tokenId: number,
  provider: ethers.providers.JsonRpcProvider
): Promise<UniswapNFTPosition | undefined> {
  const chainId = (await provider.getNetwork()).chainId;
  const nftManager = new ethers.Contract(
    UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId],
    uniswapNonFungiblePositionsAbi,
    provider
  );
  const position = await nftManager.positions(tokenId);
  const owner = await nftManager.ownerOf(tokenId);
  const token0 = getToken(chainId, position[2]);
  const token1 = getToken(chainId, position[3]);
  if (token0 === undefined || token1 === undefined) return undefined;
  const uniswapPosition: UniswapNFTPosition = {
    owner,
    operator: position[1],
    token0,
    token1,
    fee: position[4],
    lower: position[5],
    upper: position[6],
    liquidity: JSBI.BigInt(position[7].toString()),
    tokenId: tokenId,
  };
  return uniswapPosition;
}

export async function fetchUniswapNFTPositions(
  userAddress: Address,
  provider: ethers.providers.JsonRpcProvider | ethers.providers.FallbackProvider
): Promise<Map<number, UniswapNFTPosition>> {
  const chainId = (await provider.getNetwork()).chainId;
  const nftManager = new ethers.Contract(
    UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId],
    uniswapNonFungiblePositionsAbi,
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
      abi: uniswapNonFungiblePositionsAbi as any,
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
      abi: uniswapNonFungiblePositionsAbi as any,
      calls: positionsCallContexts,
    },
  ];
  const positionsResults = (await multicall.call(positionsCallContext)).results['uniswapNFTManager'];
  const callsReturnContext = convertBigNumbersForReturnContexts(positionsResults.callsReturnContext);
  const result: Map<number, UniswapNFTPosition> = new Map();

  for (let i = 0; i < tokenIds.length; i++) {
    const position = callsReturnContext[i].returnValues;
    const token0 = getToken(chainId, position[2]);
    const token1 = getToken(chainId, position[3]);
    if (token0 === undefined || token1 === undefined) continue;
    const uniswapPosition: UniswapNFTPosition = {
      owner: userAddress,
      operator: position[1],
      token0,
      token1,
      fee: position[4],
      lower: position[5],
      upper: position[6],
      liquidity: JSBI.BigInt(position[7].toString()),
      tokenId: tokenIds[i],
    };
    result.set(tokenIds[i], uniswapPosition);
  }
  return result;
}

async function fetchLiquidityChartData(poolAddress: string, chainId: number): Promise<LiquidityChartV2> {
  const liquidityChartData: LiquidityChartV2 = (
    await okuFetch(chainId, 'liquidityChartV2', [poolAddress.toLowerCase(), 0])
  ).result;
  return liquidityChartData;
}

export async function calculateTickData(poolAddress: string, chainId: number): Promise<TickData[]> {
  const liquidityChartData = await fetchLiquidityChartData(poolAddress, chainId);
  if (liquidityChartData === null) return [];

  const currentTick = liquidityChartData.current_pool_tick;

  const tickOffset = (TOTAL_NUM_TICKS / 2) * liquidityChartData.tick_spacing;

  const aboveFiltered = liquidityChartData.above
    .filter((element) => element.tick >= currentTick - tickOffset && element.tick <= currentTick + tickOffset)
    .map((element) => {
      return {
        tick: element.tick,
        liquidityDensity: element.amount,
      };
    });

  const belowFiltered = liquidityChartData.below
    .filter((element) => element.tick >= currentTick - tickOffset && element.tick <= currentTick + tickOffset)
    .map((element) => {
      return {
        tick: element.tick,
        liquidityDensity: element.amount * element.price0,
      };
    });

  const filtered = aboveFiltered.concat(belowFiltered).sort((a, b) => a.tick - b.tick);

  const tickData: TickData[] = filtered;

  // let liquidity = 0n;

  // console.log(rawTicksData);

  // for (const element of rawTicksData) {
  //   const tick = element.tickIdx;
  //   const liquidityNet = element.liquidityNet;
  //   const price0 = isFinite(element.price0) ? new Big(element.price0) : new Big(Number.MAX_SAFE_INTEGER);
  //   const price1 = isFinite(element.price1) ? new Big(element.price1) : new Big(Number.MAX_SAFE_INTEGER);

  //   liquidity += liquidityNet;

  //   const tickSpacing = 10; // TODO: Fix this

  //   const price = tickToPrice(tick, poolLiquidityData.token0Decimals, poolLiquidityData.token1Decimals);
  //   const [amount0, amount1] = getAmountsForLiquidity(
  //     {
  //       liquidity: JSBI.BigInt(liquidity.toString()),
  //       lower: tick,
  //       upper: tick + tickSpacing,
  //     },
  //     tick,
  //     poolLiquidityData.token0Decimals,
  //     poolLiquidityData.token1Decimals
  //   );
  //   const liquidityDensity = (amount1 + (amount0 * price));

  //   tickData.push({
  //     tick,
  //     liquidityDensity,
  //   });
  // }

  return tickData;
}

export async function getPoolFees(poolAddress: string, chainId: number): Promise<PoolFees> {
  return (await okuFetch(chainId, 'getPoolFees', [poolAddress.toLowerCase()])).result?.[0];
}

function modQ24(value: number) {
  return value & 0b00000000111111111111111111111111;
}

export function zip(uniswapPositions: readonly UniswapPosition[], tag?: Hex) {
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

  if (tag) {
    const shiftedTag = JSBI.leftShift(JSBI.BigInt(tag), JSBI.BigInt(144));
    return JSBI.add(shiftedTag, zipped).toString(10);
  }

  return zipped.toString(10);
}

export function computePoolAddress({
  chainId,
  token0,
  token1,
  fee,
}: {
  chainId: number;
  token0: Token;
  token1: Token;
  fee: number;
}): Address {
  return getCreate2Address(
    UNISWAP_FACTORY_ADDRESS[chainId],
    keccak256(
      ['bytes'],
      [defaultAbiCoder.encode(['address', 'address', 'uint24'], [token0.address, token1.address, fee])]
    ),
    POOL_INIT_CODE_HASH
  ) as Address;
}
