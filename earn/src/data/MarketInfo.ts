import Big from 'big.js';
import { secondsInYear } from 'date-fns';
import { ethers } from 'ethers';
import { toBig, toImpreciseNumber } from 'shared/lib/util/Numbers';
import { Address } from 'wagmi';

export type MarketInfo = {
  lender0: Address;
  lender1: Address;
  borrowerAPR0: number;
  borrowerAPR1: number;
  lender0Utilization: number;
  lender1Utilization: number;
  lender0TotalAssets: Big;
  lender1TotalAssets: Big;
  lender0TotalBorrows: Big;
  lender1TotalBorrows: Big;
  lender0AvailableAssets: Big;
  lender1AvailableAssets: Big;
};

export async function fetchMarketInfoFor(
  lenderLensContract: ethers.Contract,
  lender0: Address,
  lender1: Address
): Promise<MarketInfo> {
  const [lender0Basics, lender1Basics] = await Promise.all([
    lenderLensContract.readBasics(lender0),
    lenderLensContract.readBasics(lender1),
  ]);

  const interestRate0 = toBig(lender0Basics.interestRate);
  const borrowAPR0 = interestRate0.eq('0') ? 0 : interestRate0.sub(1e12).div(1e12).toNumber() * secondsInYear;
  const interestRate1 = toBig(lender1Basics.interestRate);
  const borrowAPR1 = interestRate1.eq('0') ? 0 : interestRate1.sub(1e12).div(1e12).toNumber() * secondsInYear;
  const lender0Utilization = toImpreciseNumber(lender0Basics.utilization, 18);
  const lender1Utilization = toImpreciseNumber(lender1Basics.utilization, 18);
  const lender0Inventory = toBig(lender0Basics.inventory);
  const lender1Inventory = toBig(lender1Basics.inventory);
  const lender0TotalBorrows = toBig(lender0Basics.totalBorrows);
  const lender1TotalBorrows = toBig(lender1Basics.totalBorrows);
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
