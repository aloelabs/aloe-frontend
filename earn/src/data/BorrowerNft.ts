import { useMemo } from 'react';

import Big from 'big.js';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { BigNumber, ethers } from 'ethers';
import { borrowerLensAbi } from 'shared/lib/abis/BorrowerLens';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { Borrower } from 'shared/lib/data/Borrower';
import {
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_BORROWER_NFT_ADDRESS,
  MULTICALL_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { GNFormat } from 'shared/lib/data/GoodNumber';
import { LendingPair } from 'shared/lib/data/LendingPair';
import { BorrowerNftRef } from 'shared/lib/hooks/UseBorrowerNft';
import { filterNullishValues } from 'shared/lib/util/Arrays';
import { Address, GetContractEventsReturnType } from 'viem';

import { MarginAccount } from './MarginAccount';

export type BorrowerNft = {
  borrowerAddress: Address;
  tokenId: string;
  index: number;
  mostRecentModify?: ethers.Event;
};

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

type BorrowerNftFilterParams = {
  validManagerSet?: Set<Address>;
  validUniswapPool?: Address;
  onlyCheckMostRecentModify: boolean;
  includeFreshBorrowers: boolean;
};

export async function fetchListOfBorrowerNfts(
  chainId: number,
  provider: ethers.providers.BaseProvider,
  userAddress: string,
  filterParams?: BorrowerNftFilterParams
): Promise<Array<BorrowerNft>> {
  const borrowerNftContract = new ethers.Contract(ALOE_II_BORROWER_NFT_ADDRESS[chainId], borrowerNftAbi, provider);

  // Fetch decoded SSTORE2 data from the BorrowerNFT (tokenIds in a specific order)
  const orderedTokenIds = (await borrowerNftContract.tokensOf(userAddress)) as BigNumber[];
  const orderedTokenIdStrs = orderedTokenIds.map((id) => '0x' + id.toHexString().slice(2).padStart(44, '0'));

  // Query all `Modify` events associated with `userAddress`
  // --> indexed args are: [address owner, address borrower, address manager]
  const modifys = await borrowerNftContract.queryFilter(
    borrowerNftContract.filters.Modify(userAddress, null, null),
    0,
    'latest'
  );
  // Sort in reverse chronological order
  modifys.sort((a, b) => {
    if (a.blockNumber === b.blockNumber) {
      if (a.transactionIndex === b.transactionIndex) {
        return b.logIndex - a.logIndex;
      }
      return b.transactionIndex - a.transactionIndex;
    }
    return b.blockNumber - a.blockNumber;
  });

  // Create a mapping from (borrowerAddress => managerSet), which we'll need for filtering
  const borrowerManagerSets: Map<Address, Set<Address>> = new Map();
  // Also store the most recent event (solely for displaying on the advanced paged)
  const borrowerMostRecentManager: Map<Address, ethers.Event> = new Map();
  modifys.forEach((modify) => {
    const borrower = modify.args!['borrower'] as Address;
    const manager = modify.args!['manager'] as Address;
    if (borrowerManagerSets.has(borrower)) {
      // If there's already a managerSet for this `borrower`, add to it UNLESS we only care about the most recent modify
      if (!(filterParams?.onlyCheckMostRecentModify ?? false)) borrowerManagerSets.get(borrower)!.add(manager);
    } else {
      // If there's no managerSet yet, create one
      borrowerManagerSets.set(borrower, new Set<Address>([manager]));
      borrowerMostRecentManager.set(borrower, modify);
    }
  });
  orderedTokenIdStrs.forEach((orderedTokenIdStr) => {
    const borrower = ethers.utils.getAddress(orderedTokenIdStr.slice(0, 42)) as Address;
    if (!borrowerManagerSets.has(borrower)) borrowerManagerSets.set(borrower, new Set<Address>());
  });

  const borrowersThatAreInUse = new Set<Address>();
  const borrowersInCorrectPool = new Set<Address>();

  // Fetch borrowers' in-use status and Uniswap pool, which we'll need for filtering
  if (
    (filterParams?.includeFreshBorrowers || Boolean(filterParams?.validUniswapPool)) &&
    borrowerManagerSets.size > 0
  ) {
    const lensContext: ContractCallContext[] = [
      {
        reference: 'lens',
        contractAddress: ALOE_II_BORROWER_LENS_ADDRESS[chainId],
        abi: borrowerLensAbi as any,
        calls: Array.from(borrowerManagerSets.keys()).map((borrower) => ({
          reference: borrower,
          methodName: 'isInUse',
          methodParameters: [borrower],
        })),
      },
    ];

    // Execute multicall fetch
    const multicall = new Multicall({
      ethersProvider: provider,
      tryAggregate: true,
      multicallCustomContractAddress: MULTICALL_ADDRESS[chainId],
    });
    const lensResults = (await multicall.call(lensContext)).results['lens'].callsReturnContext;
    if (lensResults.find((v) => !v.success || !v.decoded)) {
      throw new Error('Multicall error while checking whether Borrowers are in use');
    }
    lensResults.forEach((res) => {
      const [isInUse, pool] = res.returnValues;
      if (isInUse) borrowersThatAreInUse.add(res.reference as Address);
      if (
        filterParams?.validUniswapPool === undefined ||
        filterParams.validUniswapPool.toLowerCase() === pool.toLowerCase()
      ) {
        borrowersInCorrectPool.add(res.reference as Address);
      }
    });
  }

  // Filter out borrowers that have been used with invalid managers, then discard the managerSet (no longer need it).
  // Borrowers that have been minted but not modified pass the check and are included.
  const borrowers = Array.from(borrowerManagerSets.entries())
    .filter(([borrower, managerSet]) => {
      const areManagersValid = Array.from(managerSet.values()).every(
        (x) => filterParams?.validManagerSet?.has(x) ?? true
      );
      const isInUse = borrowersThatAreInUse.has(borrower);
      const isInCorrectPool = filterParams?.validUniswapPool === undefined || borrowersInCorrectPool.has(borrower);
      return (areManagersValid || (filterParams?.includeFreshBorrowers && !isInUse)) && isInCorrectPool;
    })
    .map(([borrower, _managerSet]) => borrower);

  return filterNullishValues(
    borrowers.map((borrower) => {
      const tokenId = orderedTokenIdStrs.find((x) => x.startsWith(borrower.toLowerCase()))!;
      const index = orderedTokenIdStrs.findIndex((x) => x.startsWith(borrower.toLowerCase()));

      if (tokenId === undefined || index === -1) {
        // If we can't find the tokenId or index, something is wrong (skip this borrower)
        console.warn(`Borrower ${borrower} has no tokenId or index`);
        return null;
      }
      return {
        borrowerAddress: borrower,
        tokenId,
        index,
        mostRecentModify: borrowerMostRecentManager.get(borrower),
      };
    })
  );
}
