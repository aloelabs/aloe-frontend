import { TickMath } from '@uniswap/v3-sdk';
import { Chain, Provider } from '@wagmi/core';
import Big from 'big.js';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { CallContext } from 'ethereum-multicall/dist/esm/models';
import { BigNumber, ethers } from 'ethers';
import JSBI from 'jsbi';

import UniswapNFTManagerABI from '../assets/abis/UniswapNFTManager.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { convertBigNumbersForReturnContexts } from '../util/Multicall';
import { toBig } from '../util/Numbers';
import { UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from './constants/Addresses';
import { BIGQ96, Q96 } from './constants/Values';
import { Token } from './Token';
import { getToken } from './TokenData';

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
  provider: Provider
) {
  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
  });
  const keys = priors.map((prior) => uniswapPositionKey(marginAccountAddress, prior.lower!, prior.upper!));
  const contractCallContext: ContractCallContext[] = [];
  keys.forEach((key) => {
    contractCallContext.push({
      reference: 'uniswapV3Pool',
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
  const updatedReturnContext = convertBigNumbersForReturnContexts(results['uniswapV3Pool'].callsReturnContext);

  const fetchedUniswapPositions = new Map<string, UniswapPosition>();
  priors.forEach((prior, i) => {
    const liquidity = JSBI.BigInt(updatedReturnContext[0].returnValues[0].toString());
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
  const multicall = new Multicall({ ethersProvider: provider, tryAggregate: true });
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
  provider: Provider,
  chain: Chain
): Promise<Map<number, UniswapNFTPosition>> {
  const nftManager = new ethers.Contract(UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS, UniswapNFTManagerABI, provider);
  const numPositions: BigNumber = await nftManager.balanceOf(userAddress);
  const multicall = new Multicall({ ethersProvider: provider, tryAggregate: true });
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
      contractAddress: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
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
      contractAddress: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
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
      token0: getToken(chain.id, position[2]),
      token1: getToken(chain.id, position[3]),
      fee: position[4],
      tickLower: position[5],
      tickUpper: position[6],
      liquidity: JSBI.BigInt(position[7].toString()),
    };
    result.set(tokenIds[i], uniswapPosition);
  }
  return result;
}
