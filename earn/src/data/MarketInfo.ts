import { secondsInYear } from 'date-fns';
import { Multicall } from 'ethereum-multicall';
import { CallContext, ContractCallContext } from 'ethereum-multicall/dist/esm/models';
import { ethers } from 'ethers';
import { lenderLensAbi } from 'shared/lib/abis/LenderLens';
import { ALOE_II_LENDER_LENS_ADDRESS, MULTICALL_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN } from 'shared/lib/data/GoodNumber';
import { toBig, toImpreciseNumber } from 'shared/lib/util/Numbers';
import { Address } from 'wagmi';

import { convertBigNumbersForReturnContexts } from '../util/Multicall';

// TODO: This is completely unnecessary. All info is available in `lendingPairs` (just need to refactor for GN)
export type MarketInfo = {
  lender0: Address;
  lender1: Address;
  borrowerAPR0: number;
  borrowerAPR1: number;
  lender0Utilization: number;
  lender1Utilization: number;
  lender0TotalAssets: GN;
  lender1TotalAssets: GN;
  lender0TotalBorrows: GN;
  lender1TotalBorrows: GN;
  lender0AvailableAssets: GN;
  lender1AvailableAssets: GN;
};

export type Market = {
  lender0: Address;
  lender1: Address;
  token0Decimals: number;
  token1Decimals: number;
};

// TODO: This is completely unnecessary. All info is available in `lendingPairs` (just need to refactor for GN)
export async function fetchMarketInfos(
  markets: Market[],
  chainId: number,
  provider: ethers.providers.Provider
): Promise<Array<MarketInfo>> {
  if (markets.length === 0) return [];
  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chainId],
  });
  const marketCallContexts: CallContext[] = [];
  markets.forEach(({ lender0, lender1 }) => {
    marketCallContexts.push({
      methodName: 'readBasics',
      methodParameters: [lender0],
      reference: 'lender0',
    });
    marketCallContexts.push({
      methodName: 'readBasics',
      methodParameters: [lender1],
      reference: 'lender1',
    });
  });

  const marketCallContext: ContractCallContext[] = [
    {
      abi: lenderLensAbi as any,
      calls: marketCallContexts,
      contractAddress: ALOE_II_LENDER_LENS_ADDRESS[chainId],
      reference: 'lenderLens',
    },
  ];

  const lenderLensResults = (await multicall.call(marketCallContext)).results['lenderLens'];

  const marketInfoResults = convertBigNumbersForReturnContexts(lenderLensResults.callsReturnContext);

  return markets.map(({ lender0, lender1, token0Decimals, token1Decimals }, index) => {
    const lender0Basics = marketInfoResults[index * 2];
    const lender1Basics = marketInfoResults[index * 2 + 1];

    const interestRate0 = toBig(lender0Basics.returnValues[1]);
    const borrowAPR0 = interestRate0.eq('0') ? 0 : interestRate0.div(1e12).toNumber() * secondsInYear;

    const interestRate1 = toBig(lender1Basics.returnValues[1]);
    const borrowAPR1 = interestRate1.eq('0') ? 0 : interestRate1.div(1e12).toNumber() * secondsInYear;

    const lender0Utilization = toImpreciseNumber(lender0Basics.returnValues[2], 18);
    const lender1Utilization = toImpreciseNumber(lender1Basics.returnValues[2], 18);
    const lender0Inventory = GN.fromBigNumber(lender0Basics.returnValues[3], token0Decimals);
    const lender1Inventory = GN.fromBigNumber(lender1Basics.returnValues[3], token1Decimals);
    const lender0TotalBorrows = GN.fromBigNumber(lender0Basics.returnValues[4], token0Decimals);
    const lender1TotalBorrows = GN.fromBigNumber(lender1Basics.returnValues[4], token1Decimals);

    return {
      lender0,
      lender1,
      borrowerAPR0: borrowAPR0,
      borrowerAPR1: borrowAPR1,
      lender0Utilization: lender0Utilization,
      lender1Utilization: lender1Utilization,
      lender0TotalAssets: lender0Inventory,
      lender1TotalAssets: lender1Inventory,
      lender0TotalBorrows: lender0TotalBorrows,
      lender1TotalBorrows: lender1TotalBorrows,
      lender0AvailableAssets: lender0Inventory.sub(lender0TotalBorrows),
      lender1AvailableAssets: lender1Inventory.sub(lender1TotalBorrows),
    } as MarketInfo;
  });
}

export async function fetchMarketInfoFor(
  lenderLensContract: ethers.Contract,
  lender0: Address,
  lender1: Address,
  token0Decimals: number,
  token1Decimals: number
): Promise<MarketInfo> {
  const [lender0Basics, lender1Basics] = await Promise.all([
    lenderLensContract.readBasics(lender0),
    lenderLensContract.readBasics(lender1),
  ]);

  const interestRate0 = toBig(lender0Basics.interestRate);
  const borrowAPR0 = interestRate0.eq('0') ? 0 : interestRate0.div(1e12).toNumber() * secondsInYear;
  const interestRate1 = toBig(lender1Basics.interestRate);
  const borrowAPR1 = interestRate1.eq('0') ? 0 : interestRate1.div(1e12).toNumber() * secondsInYear;
  const lender0Utilization = toImpreciseNumber(lender0Basics.utilization, 18);
  const lender1Utilization = toImpreciseNumber(lender1Basics.utilization, 18);
  const lender0Inventory = GN.fromBigNumber(lender0Basics.inventory, token0Decimals);
  const lender1Inventory = GN.fromBigNumber(lender1Basics.inventory, token1Decimals);
  const lender0TotalBorrows = GN.fromBigNumber(lender0Basics.totalBorrows, token0Decimals);
  const lender1TotalBorrows = GN.fromBigNumber(lender1Basics.totalBorrows, token1Decimals);
  return {
    lender0,
    lender1,
    borrowerAPR0: borrowAPR0,
    borrowerAPR1: borrowAPR1,
    lender0Utilization: lender0Utilization,
    lender1Utilization: lender1Utilization,
    lender0TotalAssets: lender0Inventory,
    lender1TotalAssets: lender1Inventory,
    lender0TotalBorrows: lender0TotalBorrows,
    lender1TotalBorrows: lender1TotalBorrows,
    lender0AvailableAssets: lender0Inventory.sub(lender0TotalBorrows),
    lender1AvailableAssets: lender1Inventory.sub(lender1TotalBorrows),
  };
}
