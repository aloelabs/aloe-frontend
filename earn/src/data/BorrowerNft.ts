import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { BigNumber, ethers } from 'ethers';
import { borrowerLensAbi } from 'shared/lib/abis/BorrowerLens';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import {
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS,
  ALOE_II_PERMIT2_MANAGER_ADDRESS,
  ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS,
  MULTICALL_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { filterNullishValues } from 'shared/lib/util/Arrays';
import { Address } from 'wagmi';

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
  mostRecentModify?: ethers.Event;
};

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

export async function fetchListOfFuse2BorrowNfts(
  chainId: number,
  provider: ethers.providers.BaseProvider,
  userAddress: Address,
  uniswapPool?: Address
): Promise<Array<BorrowerNft>> {
  const originalBorrowerNfts = await fetchListOfBorrowerNfts(chainId, provider, userAddress, {
    includeFreshBorrowers: false, // TODO: change later
    onlyCheckMostRecentModify: true, // TODO: Hayden has concerns (as usual)
    validManagerSet: new Set([
      ALOE_II_PERMIT2_MANAGER_ADDRESS[chainId],
      ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS[chainId],
      ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS[chainId],
    ]),
    validUniswapPool: uniswapPool,
  });

  return originalBorrowerNfts;

  // const slot0Contexts: ContractCallContext[] = originalBorrowerNfts.map((borrowerNft) => {
  //   return {
  //     abi: borrowerAbi as any,
  //     calls: [
  //       {
  //         methodName: 'slot0',
  //         methodParameters: [],
  //         reference: 'slot0',
  //       },
  //     ],
  //     contractAddress: borrowerNft.borrowerAddress,
  //     reference: borrowerNft.borrowerAddress,
  //   };
  // });

  // // Execute multicall fetch
  // const multicall = new Multicall({
  //   ethersProvider: provider,
  //   tryAggregate: true,
  //   multicallCustomContractAddress: MULTICALL_ADDRESS[chainId],
  // });

  // const slot0Results = await multicall.call(slot0Contexts);

  // // TODO: setup contracts to always append this. right now only the Permit2Manager does.
  // return originalBorrowerNfts.filter((borrowerNft) => {
  //   const result = slot0Results.results[borrowerNft.borrowerAddress];
  //   const slot0Hex = result.callsReturnContext[0].returnValues[0].hex;
  //   const extraDataHex: string = slot0Hex.slice(14, 30);
  //   return extraDataHex.endsWith('83ee755b');
  // });
}
