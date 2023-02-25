import Big from 'big.js';
import { secondsInYear } from 'date-fns';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { ethers } from 'ethers';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { Address, Chain } from 'wagmi';

import KittyLensABI from '../assets/abis/KittyLens.json';
import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import VolatilityOracleABI from '../assets/abis/VolatilityOracle.json';
import { makeEtherscanRequest } from '../util/Etherscan';
import { ContractCallReturnContextEntries, convertBigNumbersForReturnContexts } from '../util/Multicall';
import { toBig } from '../util/Numbers';
import {
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_ORACLE,
  ALOE_II_KITTY_LENS_ADDRESS,
} from './constants/Addresses';
import { TOPIC0_CREATE_BORROWER_EVENT } from './constants/Signatures';
import { Token } from './Token';
import { getToken } from './TokenData';

export type Assets = {
  token0Raw: number;
  token1Raw: number;
  uni0: number;
  uni1: number;
};

export type Liabilities = {
  amount0: number;
  amount1: number;
};

/**
 * For the use-cases that require all of the data
 */
export type MarginAccount = {
  address: string;
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
};

export type MarketInfo = {
  lender0: Address;
  lender1: Address;
  borrowerAPR0: number;
  borrowerAPR1: number;
  lender0Utilization: number;
  lender1Utilization: number;
  lender0TotalSupply: Big;
  lender1TotalSupply: Big;
  lender0TotalBorrows: Big;
  lender1TotalBorrows: Big;
};

/**
 * For the use-cases that may not require all of the data
 * (When we don't want to fetch more than we need)
 */
export type MarginAccountPreview = Omit<MarginAccount, 'sqrtPriceX96' | 'lender0' | 'lender1' | 'iv'>;

export async function getMarginAccountsForUser(
  chain: Chain,
  userAddress: string,
  provider: ethers.providers.Provider
): Promise<{ address: string; uniswapPool: string }[]> {
  const etherscanResult = await makeEtherscanRequest(
    0,
    ALOE_II_FACTORY_ADDRESS,
    [TOPIC0_CREATE_BORROWER_EVENT, null, `0x000000000000000000000000${userAddress.slice(2)}`],
    true,
    chain
  );
  if (!Array.isArray(etherscanResult.data.result)) return [];

  const accounts: { address: string; uniswapPool: string }[] = etherscanResult.data.result.map((item: any) => {
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

export async function fetchMarginAccounts(
  chain: Chain,
  provider: ethers.providers.BaseProvider,
  userAddress: string,
  uniswapPoolDataMap: Map<string, UniswapPoolInfo>
): Promise<MarginAccount[]> {
  const multicall = new Multicall({ ethersProvider: provider, tryAggregate: true });
  const marginAccountsAddresses = await getMarginAccountsForUser(chain, userAddress, provider);
  const marginAccountCallContext: ContractCallContext[] = [];

  // Fetch all the data for the margin accounts
  marginAccountsAddresses.forEach(({ address: accountAddress, uniswapPool }) => {
    const uniswapPoolInfo = uniswapPoolDataMap.get(`0x${uniswapPool}`) ?? null;

    if (uniswapPoolInfo === null) return;

    const token0 = uniswapPoolInfo.token0;
    const token1 = uniswapPoolInfo.token1;
    const fee = uniswapPoolInfo.fee;

    if (!token0 || !token1) return;
    // Fetching the data for the margin account using three contracts
    marginAccountCallContext.push({
      reference: `${accountAddress}-account`,
      contractAddress: accountAddress,
      abi: MarginAccountABI,
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
      ],
    });
    marginAccountCallContext.push({
      reference: `${accountAddress}-oracle`,
      contractAddress: ALOE_II_ORACLE,
      abi: VolatilityOracleABI,
      calls: [
        {
          reference: 'consult',
          methodName: 'consult',
          methodParameters: [uniswapPool],
        },
      ],
    });
    marginAccountCallContext.push({
      reference: `${accountAddress}-lens`,
      contractAddress: ALOE_II_BORROWER_LENS_ADDRESS,
      abi: MarginAccountLensABI,
      calls: [
        {
          reference: 'getAssets',
          methodName: 'getAssets',
          methodParameters: [accountAddress],
        },
        {
          reference: 'getLiabilities',
          methodName: 'getLiabilities',
          methodParameters: [accountAddress, true],
        },
        {
          reference: 'getHealth',
          methodName: 'getHealth',
          methodParameters: [accountAddress, true],
        },
      ],
      context: {
        fee: fee,
        token0Address: token0.address,
        token1Address: token1.address,
        chainId: chain.id,
        accountAddress: accountAddress,
        uniswapPool: uniswapPool,
      },
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
    const { lens: lensResults, account: accountResults, oracle: oracleResults } = value;
    const lensReturnContexts = convertBigNumbersForReturnContexts(lensResults.callsReturnContext);
    const { fee, token0Address, token1Address, chainId, accountAddress, uniswapPool } =
      lensResults.originalContractCallContext.context;
    // Reconstruct the objects (since we can't transfer them as is through the context)
    const feeTier = NumericFeeTierToEnum(fee);
    const token0 = getToken(chainId, token0Address);
    const token1 = getToken(chainId, token1Address);
    const assetsData = lensReturnContexts[0].returnValues;
    const liabilitiesData = lensReturnContexts[1].returnValues;
    const healthData = lensReturnContexts[2].returnValues;
    const healthData0 = Big(healthData[0].toString());
    const healthData1 = Big(healthData[1].toString());
    const health = healthData0.lt(healthData1) ? healthData0 : healthData1;
    const assets: Assets = {
      token0Raw: Big(assetsData[0].toString())
        .div(10 ** token0.decimals)
        .toNumber(),
      token1Raw: Big(assetsData[1].toString())
        .div(10 ** token1.decimals)
        .toNumber(),
      uni0: Big(assetsData[4].toString())
        .div(10 ** token0.decimals)
        .toNumber(),
      uni1: Big(assetsData[5].toString())
        .div(10 ** token1.decimals)
        .toNumber(),
    };
    const liabilities: Liabilities = {
      amount0: Big(liabilitiesData[0].toString())
        .div(10 ** token0.decimals)
        .toNumber(),
      amount1: Big(liabilitiesData[1].toString())
        .div(10 ** token1.decimals)
        .toNumber(),
    };
    const lender0 = accountResults.callsReturnContext[0].returnValues[0];
    const lender1 = accountResults.callsReturnContext[1].returnValues[0];
    const oracleReturnValues = convertBigNumbersForReturnContexts(oracleResults.callsReturnContext)[0].returnValues;
    const marginAccount: MarginAccount = {
      address: accountAddress,
      uniswapPool: uniswapPool,
      feeTier: feeTier,
      assets: assets,
      liabilities: liabilities,
      health: health.toNumber(),
      token0: token0,
      token1: token1,
      lender0: lender0,
      lender1: lender1,
      sqrtPriceX96: toBig(oracleReturnValues[0]),
      iv: oracleReturnValues[1].div(1e9).toNumber() / 1e9,
    };
    marginAccounts.push(marginAccount);
  });

  return marginAccounts;
}

export async function fetchMarketInfoFor(
  lenderLensContract: ethers.Contract,
  lender0: Address,
  lender1: Address
): Promise<MarketInfo> {
  const multicall = new Multicall({ ethersProvider: lenderLensContract.provider, tryAggregate: true });
  const contractCallContext: ContractCallContext[] = [
    {
      reference: 'readBasics',
      contractAddress: ALOE_II_KITTY_LENS_ADDRESS,
      abi: KittyLensABI,
      calls: [
        {
          reference: 'lender0',
          methodName: 'readBasics',
          methodParameters: [lender0],
        },
        {
          reference: 'lender1',
          methodName: 'readBasics',
          methodParameters: [lender1],
        },
      ],
    },
  ];

  const results = (await multicall.call(contractCallContext)).results;
  const updatedReturnContext = convertBigNumbersForReturnContexts(results['readBasics'].callsReturnContext);
  const lender0Basics = updatedReturnContext[0].returnValues;
  const lender1Basics = updatedReturnContext[1].returnValues;

  const interestRate0 = new Big(lender0Basics[1].toString());
  const borrowAPR0 = interestRate0.eq('0') ? 0 : interestRate0.sub(1e12).div(1e12).toNumber() * secondsInYear;
  const interestRate1 = new Big(lender1Basics[1].toString());
  const borrowAPR1 = interestRate1.eq('0') ? 0 : interestRate1.sub(1e12).div(1e12).toNumber() * secondsInYear;
  const lender0Utilization = new Big(lender0Basics[2].toString()).div(10 ** 18).toNumber();
  const lender1Utilization = new Big(lender1Basics[2].toString()).div(10 ** 18).toNumber();
  const lender0TotalSupply = new Big(lender0Basics[3].toString());
  const lender1TotalSupply = new Big(lender1Basics[3].toString());
  const lender0TotalBorrows = new Big(lender0Basics[4].toString());
  const lender1TotalBorrows = new Big(lender1Basics[4].toString());
  return {
    lender0,
    lender1,
    borrowerAPR0: borrowAPR0,
    borrowerAPR1: borrowAPR1,
    lender0Utilization: lender0Utilization,
    lender1Utilization: lender1Utilization,
    lender0TotalSupply: lender0TotalSupply,
    lender1TotalSupply: lender1TotalSupply,
    lender0TotalBorrows: lender0TotalBorrows,
    lender1TotalBorrows: lender1TotalBorrows,
  };
}
