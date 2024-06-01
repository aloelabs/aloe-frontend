import { Address } from 'viem';
import { LendingPair } from '../data/LendingPair';
import { useReadContracts } from 'wagmi';
import { borrowerLensAbi } from '../abis/BorrowerLens';
import { ALOE_II_BORROWER_LENS_ADDRESS } from '../data/constants/ChainSpecific';
import { useCallback, useMemo } from 'react';
import { Assets, DerivedBorrower } from '../data/Borrower';
import { GN } from '../data/GoodNumber';
import JSBI from 'jsbi';
import { UniswapPosition } from '../data/Uniswap';
import { useQueryClient } from '@tanstack/react-query';

export type BorrowerRef = {
  /**
   * The Uniswap pool for which the Borrower was created. Determines what tokens can be borrowed.
   * Uniswap positions in this pool can be used as collateral.
   */
  uniswapPool: Address;
  /**
   * The owner of the Borrower, i.e. the account that can call `modify`
   */
  owner: Address;
  /**
   * The address of the Borrower onchain (a proxy deployed via `factory.createBorrower`)
   */
  address: Address;
};

export function useBorrowers(
  lendingPairs: LendingPair[],
  borrowerRefs: BorrowerRef[],
  chainId: number,
  staleTime = 60 * 1_000
) {
  const { data: summaryData, queryKey: summaryKey } = useReadContracts({
    contracts: borrowerRefs.map(
      (ref) =>
        ({
          chainId,
          address: ALOE_II_BORROWER_LENS_ADDRESS[chainId],
          abi: borrowerLensAbi,
          functionName: 'getSummary',
          args: [ref.address],
        } as const)
    ),
    allowFailure: false,
    query: {
      enabled: borrowerRefs.length > 0,
      staleTime,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const lendingPairsForEvents = useMemo(() => {
    let missing = false;
    const res = borrowerRefs.map((ref) => {
      const pair = lendingPairs.find((pair) => pair.uniswapPool.toLowerCase() === ref.uniswapPool.toLowerCase());
      if (pair === undefined) missing = true;
      return pair;
    });

    if (missing) return undefined;
    return res as LendingPair[];
  }, [borrowerRefs, lendingPairs]);

  const borrowers = useMemo(() => {
    if (summaryData === undefined || lendingPairsForEvents === undefined) return undefined;
    return borrowerRefs.map((ref, i) => {
      const { uniswapPool, owner, address } = ref;
      const [balanceEth, balance0, balance1, liabilities0, liabilities1, slot0, liquidity] = summaryData[i];

      const pair = lendingPairsForEvents[i];

      const positionTicks: { lower: number; upper: number }[] = [];
      for (let i = 0; i < 3; i++) {
        const lower = BigInt.asIntN(24, (slot0 >> BigInt(24 * i * 2)) & BigInt('0xffffff'));
        const upper = BigInt.asIntN(24, (slot0 >> BigInt(24 * i * 2 + 24)) & BigInt('0xffffff'));
        if (lower === upper) continue;

        positionTicks.push({ lower: Number(lower), upper: Number(upper) });
      }

      return DerivedBorrower.from({
        ethBalance: GN.fromBigInt(balanceEth, 18),
        assets: new Assets(
          GN.fromBigInt(balance0, pair.token0.decimals),
          GN.fromBigInt(balance1, pair.token1.decimals),
          positionTicks.map((v, i) => ({ ...v, liquidity: JSBI.BigInt(liquidity[i].toString()) } as UniswapPosition))
        ),
        liabilities: {
          amount0: GN.fromBigInt(liabilities0, pair.token0.decimals),
          amount1: GN.fromBigInt(liabilities1, pair.token1.decimals),
        },
        slot0,
        address: address!,
        owner: owner!,
        uniswapPool: uniswapPool!,
      });
    });
  }, [borrowerRefs, lendingPairsForEvents, summaryData]);

  const queryClient = useQueryClient();
  const refetchBorrowers = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: summaryKey });
  }, [queryClient, summaryKey]);

  return { borrowers, refetchBorrowers };
}
