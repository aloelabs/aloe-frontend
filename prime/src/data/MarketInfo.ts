import Big from 'big.js';
import { secondsInYear } from 'date-fns';
import { ethers } from 'ethers';
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

  const interestRate0 = new Big(lender0Basics.interestRate.toString());
  const borrowAPR0 = interestRate0.eq('0') ? 0 : interestRate0.sub(1e12).div(1e12).toNumber() * secondsInYear;
  const interestRate1 = new Big(lender1Basics.interestRate.toString());
  const borrowAPR1 = interestRate1.eq('0') ? 0 : interestRate1.sub(1e12).div(1e12).toNumber() * secondsInYear;
  const lender0Utilization = new Big(lender0Basics.utilization.toString()).div(10 ** 18).toNumber();
  const lender1Utilization = new Big(lender1Basics.utilization.toString()).div(10 ** 18).toNumber();
  const lender0Inventory = new Big(lender0Basics.inventory.toString());
  const lender1Inventory = new Big(lender1Basics.inventory.toString());
  const lender0TotalBorrows = new Big(lender0Basics.totalBorrows.toString());
  const lender1TotalBorrows = new Big(lender1Basics.totalBorrows.toString());
  return {
    lender0,
    lender1,
    borrowerAPR0: borrowAPR0,
    borrowerAPR1: borrowAPR1,
    lender0Utilization: lender0Utilization,
    lender1Utilization: lender1Utilization,
    lender0TotalAssets: lender0Inventory,
    lender1TotalAssets: lender1Inventory,
    lender0AvailableAssets: lender0Inventory.sub(lender0TotalBorrows),
    lender1AvailableAssets: lender1Inventory.sub(lender1TotalBorrows),
  };
}
