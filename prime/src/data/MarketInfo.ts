import { secondsInYear } from 'date-fns';
import { ethers } from 'ethers';
import { lenderABI } from 'shared/lib/abis/Lender';
import { GN } from 'shared/lib/data/GoodNumber';
import { toBig, toImpreciseNumber } from 'shared/lib/util/Numbers';
import { Address } from 'wagmi';

export type MarketInfo = {
  lender0: Address;
  lender1: Address;
  borrowerAPR0: number;
  borrowerAPR1: number;
  lender0Utilization: number;
  lender1Utilization: number;
  lender0TotalAssets: GN;
  lender1TotalAssets: GN;
  lender0AvailableAssets: GN;
  lender1AvailableAssets: GN;
};

export async function fetchMarketInfoFor(
  lenderLensContract: ethers.Contract,
  lender0: Address,
  lender1: Address,
  token0Decimals: number,
  token1Decimals: number
): Promise<MarketInfo> {
  // TODO: get types for these
  const lenderContract0 = new ethers.Contract(lender0, lenderABI, lenderLensContract.provider);
  const lenderContract1 = new ethers.Contract(lender1, lenderABI, lenderLensContract.provider);
  const [lender0Basics, lender1Basics, reserveFactorData0, reserveFactorData1] = await Promise.all([
    lenderLensContract.readBasics(lender0),
    lenderLensContract.readBasics(lender1),
    lenderContract0.reserveFactor(),
    lenderContract1.reserveFactor(),
  ]);

  const reserveFactor0 = (1 / reserveFactorData0) * 100;
  const reserveFactor1 = (1 / reserveFactorData1) * 100;

  const interestRate0 = toBig(lender0Basics.interestRate);
  const borrowAPR0 = interestRate0.eq('0')
    ? 0
    : interestRate0.sub(1e12).div(1e12).toNumber() * secondsInYear * reserveFactor0;
  const interestRate1 = toBig(lender1Basics.interestRate);
  const borrowAPR1 = interestRate1.eq('0')
    ? 0
    : interestRate1.sub(1e12).div(1e12).toNumber() * secondsInYear * reserveFactor1;
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
    lender0AvailableAssets: lender0Inventory.sub(lender0TotalBorrows),
    lender1AvailableAssets: lender1Inventory.sub(lender1TotalBorrows),
  };
}
