import { useMemo } from 'react';

import Big from 'big.js';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { Borrower } from 'shared/lib/data/Borrower';
import { NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { GNFormat } from 'shared/lib/data/GoodNumber';
import { LendingPair } from 'shared/lib/data/LendingPair';
import { BorrowerNftRef } from 'shared/lib/hooks/UseBorrowerNft';
import { GetContractEventsReturnType } from 'viem';

import { MarginAccount } from './MarginAccount';

export type BorrowerNftBorrower = MarginAccount & {
  tokenId: string;
  index: number;
  mostRecentModify?: GetContractEventsReturnType<typeof borrowerNftAbi, 'Modify', true, 'earliest', 'latest'>[number];
};

export function useDeprecatedMarginAccountShim(
  lendingPairs: LendingPair[],
  borrowerNftRefs: BorrowerNftRef[],
  borrowers: Borrower[] | undefined
): BorrowerNftBorrower[] | null {
  return useMemo(() => {
    if (borrowers === undefined || borrowerNftRefs.length !== borrowers.length) return null;

    const borrowerNfts = borrowerNftRefs.map((ref, i) => {
      const borrower = borrowers[i];
      const pair = lendingPairs.find((pair) => pair.uniswapPool.toLowerCase() === ref.uniswapPool.toLowerCase())!;

      const sqrtPriceX96 = new Big(pair.oracleData.sqrtPriceX96.toString(GNFormat.INT));
      const iv = pair.iv;

      return {
        tokenId: ref.tokenId,
        index: ref.index,
        mostRecentModify: ref.mostRecentModify,
        address: ref.address,
        uniswapPool: ref.uniswapPool,
        token0: pair.token0,
        token1: pair.token1,
        feeTier: NumericFeeTierToEnum(pair.uniswapFeeTier),
        assets: borrower.assets,
        liabilities: {
          amount0: borrower.liabilities.amount0.toNumber(),
          amount1: borrower.liabilities.amount1.toNumber(),
        },
        sqrtPriceX96,
        health: borrower.health(sqrtPriceX96, iv, pair.factoryData.nSigma).health,
        lender0: pair.kitty0.address,
        lender1: pair.kitty1.address,
        iv,
        nSigma: pair.factoryData.nSigma,
        userDataHex: borrower.userData,
        warningTime: borrower.warnTime,
      } as BorrowerNftBorrower;
    });
    borrowerNfts.reverse();
    return borrowerNfts;
  }, [lendingPairs, borrowerNftRefs, borrowers]);
}
