import { useEffect, useMemo } from 'react';

import { SendTransactionResult, Provider } from '@wagmi/core';
import Big from 'big.js';
import { BigNumber, ethers } from 'ethers';
import JSBI from 'jsbi';
import { borrowerLensAbi } from 'shared/lib/abis/BorrowerLens';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { ALOE_II_BORROWER_LENS_ADDRESS, ALOE_II_FACTORY_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { useContractReads } from 'wagmi';

import { DerivedBorrower } from '../../../data/Borrower';
import { LendingPair } from '../../../data/LendingPair';
import { Assets } from '../../../data/MarginAccount';
import { UniswapPosition } from '../../../data/Uniswap';
import LiquidateTable, { LiquidateTableRowProps } from './LiquidateTable';

export type LiquidateTabProps = {
  // Alternatively, could get these 2 from `ChainContext` and `useProvider`, respectively
  chainId: number;
  provider: Provider;
  // Remaining 3 should be passed in for sure though
  lendingPairs: LendingPair[];
  tokenQuotes: Map<string, number>;
  setPendingTxn: (data: SendTransactionResult) => void;
};

export default function LiquidateTab(props: LiquidateTabProps) {
  const { chainId, provider, lendingPairs, tokenQuotes, setPendingTxn } = props;

  const [createBorrowerEvents, setCreateBorrowerEvents] = useChainDependentState<ethers.Event[]>([], chainId);

  // Fetch `createBorrowerEvents`
  useEffect(() => {
    (async () => {
      const chainId = (await provider.getNetwork()).chainId;
      const factory = new ethers.Contract(ALOE_II_FACTORY_ADDRESS[chainId], factoryAbi, provider);
      const logs = await factory.queryFilter(factory.filters.CreateBorrower(), 'earliest', 'latest');

      setCreateBorrowerEvents(logs.filter((log) => !log.removed && log.args !== undefined));
    })();
  }, [provider, lendingPairs, setCreateBorrowerEvents]);

  // Call `getSummary` on each borrower
  const { data: summaryData } = useContractReads({
    contracts: createBorrowerEvents.map((ev) => ({
      chainId,
      address: ALOE_II_BORROWER_LENS_ADDRESS[chainId],
      abi: borrowerLensAbi,
      functionName: 'getSummary',
      args: [ev.args?.account],
    })),
    allowFailure: false,
    enabled: createBorrowerEvents.length > 0,
  });

  const lendingPairsForEvents = useMemo(() => {
    let missing = false;
    const res = createBorrowerEvents.map((ev) => {
      const pair = lendingPairs.find((pair) => pair.uniswapPool.toLowerCase() === ev.args!.pool.toLowerCase());
      if (pair === undefined) missing = true;
      return pair;
    });

    if (missing) return undefined;
    return res as LendingPair[];
  }, [createBorrowerEvents, lendingPairs]);

  const borrowers = useMemo(() => {
    if (summaryData === undefined || lendingPairsForEvents === undefined) return undefined;
    return createBorrowerEvents.map((ev, i) => {
      const { pool: uniswapPool, owner, account: address } = ev.args!;
      const summary = summaryData[i] as {
        balanceEth: BigNumber;
        balance0: BigNumber;
        balance1: BigNumber;
        liabilities0: BigNumber;
        liabilities1: BigNumber;
        slot0: BigNumber;
        liquidity: readonly BigNumber[];
      };

      const pair = lendingPairsForEvents[i];
      const liabilities0 = GN.fromBigNumber(summary.liabilities0, pair.token0.decimals);
      const liabilities1 = GN.fromBigNumber(summary.liabilities1, pair.token1.decimals);

      const slot0 = summary.slot0;
      const positionTicks: { lower: number; upper: number }[] = [];
      for (let i = 0; i < 3; i++) {
        const lower = slot0.shr(24 * i * 2).mask(24);
        const upper = slot0.shr(24 * i * 2 + 24).mask(24);
        if (lower.eq(upper)) continue;

        positionTicks.push({ lower: lower.toNumber(), upper: upper.toNumber() });
      }

      return DerivedBorrower.from({
        ethBalance: GN.fromBigNumber(summary.balanceEth, 18),
        assets: new Assets(
          GN.fromBigNumber(summary.balance0, pair.token0.decimals),
          GN.fromBigNumber(summary.balance1, pair.token1.decimals),
          positionTicks.map(
            (v, i) => ({ ...v, liquidity: JSBI.BigInt(summary.liquidity[i].toString()) } as UniswapPosition)
          )
        ),
        liabilities: {
          amount0: liabilities0,
          amount1: liabilities1,
        },
        slot0,
        address,
        owner,
        uniswapPool,
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
