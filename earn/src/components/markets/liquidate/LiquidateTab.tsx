import { useEffect, useMemo } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import Big from 'big.js';
import JSBI from 'jsbi';
import { borrowerLensAbi } from 'shared/lib/abis/BorrowerLens';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { ALOE_II_BORROWER_LENS_ADDRESS, ALOE_II_FACTORY_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { getContract, GetContractEventsReturnType } from 'viem';
import { usePublicClient, useReadContracts } from 'wagmi';

import { DerivedBorrower } from '../../../data/Borrower';
import { LendingPair } from '../../../data/LendingPair';
import { Assets } from '../../../data/MarginAccount';
import { UniswapPosition } from '../../../data/Uniswap';
import LiquidateTable, { LiquidateTableRowProps } from './LiquidateTable';

export type LiquidateTabProps = {
  // Alternatively, could get these 2 from `ChainContext` and `useProvider`, respectively
  chainId: number;
  // Remaining 3 should be passed in for sure though
  lendingPairs: LendingPair[];
  tokenQuotes: Map<string, number>;
  setPendingTxn: (data: WriteContractReturnType) => void;
};

export default function LiquidateTab(props: LiquidateTabProps) {
  const { chainId, lendingPairs, tokenQuotes, setPendingTxn } = props;

  const [createBorrowerEvents, setCreateBorrowerEvents] = useChainDependentState<
    GetContractEventsReturnType<typeof factoryAbi, 'CreateBorrower'>
  >([], chainId);

  const publicClient = usePublicClient({ chainId });

  // Fetch `createBorrowerEvents`
  useEffect(() => {
    (async () => {
      if (!publicClient) return;
      const factory = getContract({
        address: ALOE_II_FACTORY_ADDRESS[chainId],
        abi: factoryAbi,
        client: publicClient,
      });
      const logs = await factory.getEvents.CreateBorrower(undefined, {
        fromBlock: 'earliest',
        toBlock: 'latest',
        strict: true,
      });

      setCreateBorrowerEvents(logs.filter((log) => !log.removed && log.args !== undefined));
    })();
  }, [lendingPairs, setCreateBorrowerEvents, publicClient, chainId]);

  // Call `getSummary` on each borrower
  const { data: summaryData } = useReadContracts({
    contracts: createBorrowerEvents.map(
      (ev) =>
        ({
          chainId,
          address: ALOE_II_BORROWER_LENS_ADDRESS[chainId],
          abi: borrowerLensAbi,
          functionName: 'getSummary',
          args: [ev.args?.account],
        } as const)
    ),
    allowFailure: false,
    query: { enabled: createBorrowerEvents.length > 0 },
  });

  const lendingPairsForEvents = useMemo(() => {
    let missing = false;
    const res = createBorrowerEvents.map((ev) => {
      const pair = lendingPairs.find((pair) => pair.uniswapPool.toLowerCase() === ev.args.pool!.toLowerCase());
      if (pair === undefined) missing = true;
      return pair;
    });

    if (missing) return undefined;
    return res as LendingPair[];
  }, [createBorrowerEvents, lendingPairs]);

  const borrowers = useMemo(() => {
    if (summaryData === undefined || lendingPairsForEvents === undefined) return undefined;
    return createBorrowerEvents.map((ev, i) => {
      const { pool: uniswapPool, owner, account: address } = ev.args;
      const [balanceEth, balance0, balance1, liabilities0, liabilities1, slot0, liquidity] = summaryData[i];

      const pair = lendingPairsForEvents[i];

      const positionTicks: { lower: number; upper: number }[] = [];
      for (let i = 0; i < 3; i++) {
        const lower = (slot0 >> BigInt(24 * i * 2)) & BigInt('0xffffff');
        const upper = (slot0 >> BigInt(24 * i * 2 + 24)) & BigInt('0xffffff');
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
  }, [createBorrowerEvents, lendingPairsForEvents, summaryData]);

  const rows = useMemo(() => {
    if (borrowers === undefined) return [];
    return borrowers
      .map((borrower, i) => {
        if (borrower.ethBalance.isZero()) return undefined;
        const pair = lendingPairsForEvents![i];
        const { health } = borrower.health(
          new Big(pair.oracleData.sqrtPriceX96.toString(GNFormat.INT)),
          pair.iv,
          pair.factoryData.nSigma
        );
        return {
          lendingPair: pair,
          positionValue:
            borrower.liabilities.amount0.toNumber() * (tokenQuotes.get(pair.token0.symbol) || 0) +
            borrower.liabilities.amount1.toNumber() * (tokenQuotes.get(pair.token1.symbol) || 0),
          health,
          borrower,
          setPendingTxn,
        };
      })
      .filter((row) => row !== undefined);
  }, [borrowers, lendingPairsForEvents, tokenQuotes, setPendingTxn]);

  return (
    <div className='flex flex-col gap-4'>
      <LiquidateTable rows={rows as LiquidateTableRowProps[]} />
    </div>
  );
}
