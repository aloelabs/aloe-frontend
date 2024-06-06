import { useMemo } from 'react';

import Big from 'big.js';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { Assets, Liabilities } from 'shared/lib/data/Borrower';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { LendingPair } from 'shared/lib/data/LendingPair';
import { Token } from 'shared/lib/data/Token';
import { BorrowerNft } from 'shared/lib/hooks/UseBorrowerNft';
import { Address, GetContractEventsReturnType, Hex } from 'viem';

export type MarginAccount = {
  address: Address;
  uniswapPool: Address;
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
  userDataHex: Hex;
  warningTime: number;
  ethBalance?: GN;
};

export type BorrowerNftBorrower = MarginAccount & {
  tokenId: string;
  index: number;
  mostRecentModify?: GetContractEventsReturnType<typeof borrowerNftAbi, 'Modify', true, 'earliest', 'latest'>[number];
};

export function useDeprecatedMarginAccountShim(
  lendingPairs: LendingPair[],
  borrowerNfts: BorrowerNft[]
): BorrowerNftBorrower[] | null {
  return useMemo(() => {
    if (borrowerNfts.some((nft) => nft.borrower === undefined)) return null;

    const results = borrowerNfts.map((nft) => {
      const borrower = nft.borrower!;
      const pair = lendingPairs.find((pair) => pair.uniswapPool.toLowerCase() === nft.uniswapPool.toLowerCase())!;

      const sqrtPriceX96 = new Big(pair.oracleData.sqrtPriceX96.toString(GNFormat.INT));
      const iv = pair.iv;

      return {
        tokenId: nft.tokenId,
        index: nft.index,
        mostRecentModify: nft.mostRecentModify,
        address: nft.address,
        uniswapPool: nft.uniswapPool,
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
        ethBalance: borrower.ethBalance,
      } as BorrowerNftBorrower;
    });
    results.sort((a, b) => Number((b.mostRecentModify?.blockNumber || 0n) - (a.mostRecentModify?.blockNumber || 0n)));
    return results;
  }, [lendingPairs, borrowerNfts]);
}
