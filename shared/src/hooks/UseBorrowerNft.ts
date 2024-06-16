import { Address, GetContractEventsReturnType, getAddress } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import { borrowerNftAbi } from '../abis/BorrowerNft';
import { ALOE_II_BORROWER_LENS_ADDRESS, ALOE_II_BORROWER_NFT_ADDRESS } from '../data/constants/ChainSpecific';
import useContractEvents from './UseContractEvents';
import { borrowerLensAbi } from '../abis/BorrowerLens';
import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BorrowerRef, useBorrowers } from './UseBorrowers';
import { UniswapPoolsMap } from './UseUniswapPools';
import { Borrower } from '../data/Borrower';

export type BorrowerNftRef = BorrowerRef & {
  /// The NFT's owner
  holder: Address;
  /// The NFT's tokenId in the BorrowerNFT contract
  tokenId: string;
  /// The NFT's index in the holder's SSTORE2 array
  index: number;
  /// The most recent `Modify` event (undefined if `modify` hasn't yet been called on the Borrower)
  mostRecentModify?: GetContractEventsReturnType<typeof borrowerNftAbi, 'Modify', true, 'earliest', 'latest'>[number];
};

export type BorrowerNft = BorrowerNftRef & {
  borrower?: Borrower;
};

type BorrowerNftFilterParams = {
  /**
   * Borrowers that have been modified with managers _not_ in this set will be excluded.
   * If undefined, any manager is considered valid.
   */
  validManagerSet?: Set<Address>;
  /**
   * Only borrowers associated with this Uniswap pool are included. If undefined, any
   * Uniswap pool is considered valid.
   */
  validUniswapPool?: Address;
  /**
   * Whether to test the `validManagerSet` against _all_ `Modify` events, or just the
   * most recent one.
   */
  onlyCheckMostRecentModify: boolean;
  /**
   * Whether to include borrowers that are empty and/or haven't been modified yet.
   */
  includeUnusedBorrowers: boolean;
};

export function useBorrowerNftRefs(
  owner: Address | undefined,
  chainId: number,
  filterParams?: BorrowerNftFilterParams,
  staleTime = 60_000
) {
  const borrowerNft = {
    abi: borrowerNftAbi,
    address: ALOE_II_BORROWER_NFT_ADDRESS[chainId],
    chainId,
  };

  // Fetch decoded SSTORE2 data from the BorrowerNFT (tokenIds in a specific order)
  const { data: tokenIds, queryKey: tokenIdsKey } = useReadContract({
    ...borrowerNft,
    functionName: 'tokensOf',
    args: [owner ?? '0x'],
    query: {
      enabled: owner !== undefined,
      staleTime,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  // Query all `Modify` events associated with `owner`
  const { data: modifys, refetch } = useContractEvents({
    ...borrowerNft,
    eventName: 'Modify',
    args: { owner },
    strict: true,
    query: { enabled: owner !== undefined },
  });

  // Convert `tokenIds` to hex strings
  const tokenIdStrs = useMemo(
    // NOTE: (20 byte address + 2 byte counter) = 22 bytes = 44 hex characters
    () => tokenIds?.map((id) => `0x${id.toString(16).padStart(44, '0')}`),
    [tokenIds]
  );

  const borrowerHistories = useMemo(() => {
    const map = new Map<Address, NonNullable<typeof modifys>>();

    if (tokenIdStrs === undefined || modifys === undefined) return map;

    // Create empty history for each of the `owner`'s borrowers
    tokenIdStrs.forEach((tokenIdStr) => map.set(getAddress(tokenIdStr.slice(0, 42)), []));

    // Sort `Modify` events in chronological order
    const modifysSorted = modifys.concat();
    modifysSorted.sort((a, b) => {
      if (a.blockNumber === b.blockNumber) {
        if (a.transactionIndex === b.transactionIndex) {
          return a.logIndex - b.logIndex;
        }
        return a.transactionIndex - b.transactionIndex;
      }
      return Number(a.blockNumber - b.blockNumber);
    });

    // Populate histories
    modifysSorted.forEach((modify) => map.get(modify.args.borrower)?.push(modify));

    return map;
  }, [tokenIdStrs, modifys]);

  const lensCalls = useMemo(() => {
    if (tokenIdStrs === undefined) return [];
    return tokenIdStrs.map(
      (tokenIdStr) =>
        ({
          abi: borrowerLensAbi,
          address: ALOE_II_BORROWER_LENS_ADDRESS[chainId],
          functionName: 'isInUse',
          args: [tokenIdStr.slice(0, 42) as Address],
          chainId,
        } as const)
    );
  }, [tokenIdStrs, chainId]);

  const { data: lensResults, queryKey: lensKey } = useReadContracts({
    contracts: lensCalls,
    allowFailure: false,
    query: {
      staleTime,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const borrowerNftRefs = useMemo(() => {
    if (owner === undefined || tokenIdStrs === undefined || lensResults === undefined) return [];

    const result: BorrowerNftRef[] = [];

    for (let i = 0; i < tokenIdStrs.length; i += 1) {
      const tokenIdStr = tokenIdStrs[i];
      const address = getAddress(tokenIdStr.slice(0, 42));
      const history = borrowerHistories.get(address)!;
      const mostRecentModify = history.at(-1);
      const [isInUse, uniswapPool] = lensResults[i];

      let valid = true;

      if (filterParams) {
        let areManagersValid: boolean;
        if (filterParams.validManagerSet === undefined) {
          areManagersValid = true;
        } else {
          if (filterParams.onlyCheckMostRecentModify) {
            areManagersValid =
              mostRecentModify === undefined || filterParams.validManagerSet!.has(mostRecentModify.args.manager);
          } else {
            areManagersValid = history.every((x) => filterParams.validManagerSet!.has(x.args.manager));
          }
        }

        valid &&= filterParams.validUniswapPool === undefined || filterParams.validUniswapPool === uniswapPool;
        valid &&= areManagersValid || (filterParams.includeUnusedBorrowers && !isInUse);
      }

      if (valid)
        result.push({
          address,
          owner: ALOE_II_BORROWER_NFT_ADDRESS[chainId],
          holder: owner,
          uniswapPool,
          tokenId: tokenIdStr,
          index: i,
          mostRecentModify,
        });
    }
    return result;
  }, [owner, tokenIdStrs, borrowerHistories, lensResults, filterParams, chainId]);

  const queryClient = useQueryClient();
  const refetchBorrowerNftRefs = useCallback(async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: tokenIdsKey }),
      queryClient.invalidateQueries({ queryKey: lensKey }),
    ]);
  }, [queryClient, refetch, tokenIdsKey, lensKey]);

  return { borrowerNftRefs, refetchBorrowerNftRefs };
}

export function useBorrowerNfts(
  uniswapPools: UniswapPoolsMap,
  owner: Address | undefined,
  chainId: number,
  filterParams?: BorrowerNftFilterParams,
  staleTime = 60 * 1_000
) {
  const { borrowerNftRefs, refetchBorrowerNftRefs } = useBorrowerNftRefs(owner, chainId, filterParams, staleTime);
  const { borrowers, refetchBorrowers } = useBorrowers(uniswapPools, borrowerNftRefs, chainId, staleTime);

  const borrowerNfts = useMemo(() => {
    return borrowerNftRefs.map(
      (borrowerNftRef, i) =>
        ({
          ...borrowerNftRef,
          borrower: borrowers.at(i),
        } as BorrowerNft)
    );
  }, [borrowerNftRefs, borrowers]);

  return { borrowerNfts, refetchBorrowerNftRefs, refetchBorrowers };
}
