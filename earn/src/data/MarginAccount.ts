import Big from 'big.js';
import { CallReturnContext, ContractCallContext, ContractCallReturnContext, Multicall } from 'ethereum-multicall';
import { BigNumber, ethers } from 'ethers';
import JSBI from 'jsbi';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerLensAbi } from 'shared/lib/abis/BorrowerLens';
import { erc20Abi } from 'shared/lib/abis/ERC20';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import { Assets, Liabilities } from 'shared/lib/data/Borrower';
import {
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
  MULTICALL_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { Q32 } from 'shared/lib/data/constants/Values';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { GN } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { getToken } from 'shared/lib/data/TokenData';
import { UniswapPosition } from 'shared/lib/data/Uniswap';
import { toBig, toImpreciseNumber } from 'shared/lib/util/Numbers';
import { Address } from 'viem';

import { TOPIC0_CREATE_BORROWER_EVENT } from './constants/Signatures';

type ContractCallReturnContextEntries = {
  [key: string]: ContractCallReturnContext;
};

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

/**
 * For the use-cases that require all of the data
 */
export type MarginAccount = {
  address: Address;
  uniswapPool: string;
  token0: Token;
  token1: Token;
  feeTier: FeeTier;
  assets: Assets;
  liabilities: Liabilities;
  sqrtPriceX96: Big;
  health: number;
  lender0: Address;
  lender1: Address;
  iv: number;
  nSigma: number;
  userDataHex: `0x${string}`;
  warningTime: number;
};

/**
 * For the use-cases that may not require all of the data
 * (When we don't want to fetch more than we need)
 */
export type MarginAccountPreview = Omit<MarginAccount, 'sqrtPriceX96' | 'lender0' | 'lender1' | 'iv'>;

export async function getMarginAccountsForUser(
  chainId: number,
  provider: ethers.providers.Provider,
  userAddress: string
): Promise<{ address: string; uniswapPool: string }[]> {
  let logs: ethers.providers.Log[] = [];
  try {
    logs = await provider.getLogs({
      fromBlock: 0,
      toBlock: 'latest',
      address: ALOE_II_FACTORY_ADDRESS[chainId],
      topics: [TOPIC0_CREATE_BORROWER_EVENT, null, `0x000000000000000000000000${userAddress.slice(2)}`],
    });
  } catch (e) {
    console.error(e);
  }
  if (logs.length === 0) return [];

  const accounts: { address: string; uniswapPool: string }[] = logs.map((item: any) => {
    return {
      address: item.data.slice(0, 2) + item.data.slice(26),
      uniswapPool: item.topics[1].slice(26),
    };
  });

  return accounts;
}

export type UniswapPoolInfo = {
  token0: Token;
  token1: Token;
  fee: number;
};

export async function fetchBorrowerDatas(
  chainId: number,
  provider: ethers.providers.BaseProvider,
  addresses: Address[],
  uniswapPoolDataMap: Map<string, UniswapPoolInfo>
): Promise<MarginAccount[]> {
  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chainId],
  });
  const borrowerUniswapPoolCallContext: ContractCallContext[] = addresses.map((borrowerAddress) => ({
    reference: `${borrowerAddress}`,
    contractAddress: borrowerAddress,
    abi: borrowerAbi as any,
    calls: [{ reference: 'uniswapPool', methodName: 'UNISWAP_POOL', methodParameters: [] }],
  }));
  const borrowerUniswapPools = (await multicall.call(borrowerUniswapPoolCallContext)).results;

  const marginAccountCallContext: ContractCallContext[] = [];

  // Fetch all the data for the margin accounts
  addresses.forEach((accountAddress) => {
    const uniswapPool = borrowerUniswapPools[accountAddress].callsReturnContext[0].returnValues[0];
    const uniswapPoolInfo = uniswapPoolDataMap.get(uniswapPool) ?? null;

    if (uniswapPoolInfo === null) return;

    const token0 = uniswapPoolInfo.token0;
    const token1 = uniswapPoolInfo.token1;
    const fee = uniswapPoolInfo.fee;

    if (!token0 || !token1) return;
    // Fetching the data for the margin account using three contracts
    marginAccountCallContext.push({
      reference: `${accountAddress}-account`,
      contractAddress: accountAddress,
      abi: borrowerAbi as any,
      calls: [
        {
          reference: 'lender0',
          methodName: 'LENDER0',
          methodParameters: [],
        },
        {
          reference: 'lender1',
          methodName: 'LENDER1',
          methodParameters: [],
        },
        {
          reference: 'slot0',
          methodName: 'slot0',
          methodParameters: [],
        },
        {
          reference: 'getLiabilities',
          methodName: 'getLiabilities',
          methodParameters: [],
        },
      ],
    });
    marginAccountCallContext.push({
      reference: `${accountAddress}-oracle`,
      contractAddress: ALOE_II_ORACLE_ADDRESS[chainId],
      abi: volatilityOracleAbi as any,
      calls: [
        {
          reference: 'consult',
          methodName: 'consult',
          methodParameters: [uniswapPool, Q32],
        },
      ],
    });
    marginAccountCallContext.push({
      reference: `${accountAddress}-token0`,
      contractAddress: token0.address,
      abi: erc20Abi as any,
      calls: [
        {
          reference: 'balanceOf',
          methodName: 'balanceOf',
          methodParameters: [accountAddress],
        },
      ],
    });
    marginAccountCallContext.push({
      reference: `${accountAddress}-token1`,
      contractAddress: token1.address,
      abi: erc20Abi as any,
      calls: [
        {
          reference: 'balanceOf',
          methodName: 'balanceOf',
          methodParameters: [accountAddress],
        },
      ],
    });
    marginAccountCallContext.push({
      reference: `${accountAddress}-lens`,
      contractAddress: ALOE_II_BORROWER_LENS_ADDRESS[chainId],
      abi: borrowerLensAbi as any,
      calls: [
        {
          reference: 'getHealth',
          methodName: 'getHealth',
          methodParameters: [accountAddress],
        },
        {
          reference: 'getUniswapPositions',
          methodName: 'getUniswapPositions',
          methodParameters: [accountAddress],
        },
      ],
      context: {
        fee: fee,
        token0Address: token0.address,
        token1Address: token1.address,
        chainId: chainId,
        accountAddress: accountAddress,
        uniswapPool: uniswapPool,
      },
    });
    marginAccountCallContext.push({
      reference: `${accountAddress}-nSigma`,
      contractAddress: ALOE_II_FACTORY_ADDRESS[chainId],
      abi: factoryAbi as any,
      calls: [
        {
          reference: 'getParameters',
          methodName: 'getParameters',
          methodParameters: [uniswapPool],
        },
      ],
    });
  });

  const marginAccountResults = (await multicall.call(marginAccountCallContext)).results;

  const correspondingMarginAccountResults: Map<string, ContractCallReturnContextEntries> = new Map();

  // Convert the results into a map of account address to the results
  Object.entries(marginAccountResults).forEach(([key, value]) => {
    const entryAccountAddress = key.split('-')[0];
    const entryType = key.split('-')[1];
    const existingValue = correspondingMarginAccountResults.get(entryAccountAddress);
    if (existingValue) {
      existingValue[entryType] = value;
      correspondingMarginAccountResults.set(entryAccountAddress, existingValue);
    } else {
      correspondingMarginAccountResults.set(entryAccountAddress, { [entryType]: value });
    }
  });

  const marginAccounts: MarginAccount[] = [];

  correspondingMarginAccountResults.forEach((value) => {
    const {
      lens: lensResults,
      account: accountResults,
      oracle: oracleResults,
      token0: token0Results,
      token1: token1Results,
    } = value;
    const accountReturnContexts = convertBigNumbersForReturnContexts(accountResults.callsReturnContext);
    const lensReturnContexts = convertBigNumbersForReturnContexts(lensResults.callsReturnContext);
    const token0ReturnContexts = convertBigNumbersForReturnContexts(token0Results.callsReturnContext);
    const token1ReturnContexts = convertBigNumbersForReturnContexts(token1Results.callsReturnContext);
    const { fee, token0Address, token1Address, chainId, accountAddress, uniswapPool } =
      lensResults.originalContractCallContext.context;
    // Reconstruct the objects (since we can't transfer them as is through the context)
    const feeTier = NumericFeeTierToEnum(fee);
    const token0 = getToken(chainId, token0Address)!;
    const token1 = getToken(chainId, token1Address)!;
    const liabilitiesData = accountReturnContexts[3].returnValues;
    const token0Balance = token0ReturnContexts[0].returnValues[0];
    const token1Balance = token1ReturnContexts[0].returnValues[0];
    const healthData = lensReturnContexts[0].returnValues;
    const nSigma = convertBigNumbersForReturnContexts(value.nSigma.callsReturnContext)[0].returnValues[1] / 10;

    const health = toImpreciseNumber(healthData[0].lt(healthData[1]) ? healthData[0] : healthData[1], 18);
    const liabilities: Liabilities = {
      amount0: toImpreciseNumber(liabilitiesData[0], token0.decimals),
      amount1: toImpreciseNumber(liabilitiesData[1], token1.decimals),
    };

    const uniswapPositionData = lensReturnContexts[1].returnValues;
    const uniswapPositionBounds = uniswapPositionData[0] as number[];
    const uniswapPositionLiquidity = uniswapPositionData[1] as { hex: `0x${string}` }[];

    const uniswapPositions: UniswapPosition[] = [];
    uniswapPositionLiquidity.forEach((liquidity, i) => {
      uniswapPositions.push({
        lower: uniswapPositionBounds[i * 2],
        upper: uniswapPositionBounds[i * 2 + 1],
        liquidity: JSBI.BigInt(liquidity.hex),
      });
    });
    // const uniswapPositionFees = uniswapPositionData[2];

    const assets = new Assets(
      GN.fromBigNumber(token0Balance, token0.decimals),
      GN.fromBigNumber(token1Balance, token1.decimals),
      uniswapPositions
    );

    const slot0 = accountReturnContexts[2].returnValues[0] as BigNumber;
    const userDataHex = slot0.shr(144).mask(64).toHexString() as `0x${string}`;
    const warningTime = slot0.shr(208).mask(40).toNumber();

    const oracleReturnValues = convertBigNumbersForReturnContexts(oracleResults.callsReturnContext)[0].returnValues;
    const marginAccount: MarginAccount = {
      address: accountAddress,
      sqrtPriceX96: toBig(oracleReturnValues[1]),
      iv: toImpreciseNumber(oracleReturnValues[2], 12),
      uniswapPool,
      feeTier,
      assets,
      liabilities,
      health,
      token0,
      token1,
      lender0: accountReturnContexts[0].returnValues[0],
      lender1: accountReturnContexts[1].returnValues[0],
      nSigma,
      userDataHex,
      warningTime,
    };
    marginAccounts.push(marginAccount);
  });

  return marginAccounts;
}

export async function fetchMarginAccounts(
  chainId: number,
  provider: ethers.providers.BaseProvider,
  userAddress: string,
  uniswapPoolDataMap: Map<string, UniswapPoolInfo>
): Promise<MarginAccount[]> {
  const borrowers = await getMarginAccountsForUser(chainId, provider, userAddress);
  return fetchBorrowerDatas(
    chainId,
    provider,
    borrowers.map((b) => b.address as Address),
    uniswapPoolDataMap
  );
}
