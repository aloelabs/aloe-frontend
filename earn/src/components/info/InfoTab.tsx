import { useEffect, useMemo, useState } from 'react';

import { SendTransactionResult, Provider } from '@wagmi/core';
import { secondsInDay } from 'date-fns';
import { ethers } from 'ethers';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import { ALOE_II_ORACLE_ADDRESS, APPROX_SECONDS_PER_BLOCK } from 'shared/lib/data/constants/ChainSpecific';
import { GN } from 'shared/lib/data/GoodNumber';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { Address } from 'wagmi';

import { computeLTV } from '../../data/BalanceSheet';
import { LendingPair } from '../../data/LendingPair';
import InfoGraph, { InfoGraphColors, InfoGraphData, InfoGraphLabel } from './InfoGraph';
import StatsTable from './StatsTable';

export type InfoTabProps = {
  // Alternatively, could get these 2 from `ChainContext` and `useProvider`, respectively
  chainId: number;
  provider: Provider;
  // Remaining 3 should be passed in for sure though
  blockNumber: number | undefined;
  lendingPairs: LendingPair[];
  tokenColors: Map<string, string>;
  setPendingTxn: (data: SendTransactionResult) => void;
};

const MIN_NUM_DAYS_TO_FETCH = 30;
const MAX_NUM_UPDATE_LOGS_PER_POOL_PER_DAY = 6;
const MAX_NUM_LOGS_PER_ALCHEMY_REQUEST = 2000;

export default function InfoTab(props: InfoTabProps) {
  const { chainId, provider, blockNumber, lendingPairs, tokenColors, setPendingTxn } = props;

  const [oracleLogs, setOracleLogs] = useChainDependentState(new Map<Address, ethers.Event[]>(), chainId);
  const [blockNumbersToTimestamps, setBlockNumbersToTimestamps] = useChainDependentState(
    new Map<number, number>(),
    chainId
  );
  const [hoveredPair, setHoveredPair] = useState<LendingPair | undefined>(undefined);

  // Fetch `oracleLogs`
  useEffect(() => {
    (async () => {
      if (lendingPairs.length === 0) return;
      const [chainId, currentBlockNumber] = await Promise.all([
        provider.getNetwork().then((resp) => resp.chainId),
        provider.getBlockNumber(),
      ]);
      // Calculate how many requests are necessary to fetch the desired number of days, given
      // Alchemy's `eth_getLogs` constraints.
      const worstCaseNumUpdateLogsPerDay = MAX_NUM_UPDATE_LOGS_PER_POOL_PER_DAY * lendingPairs.length;
      const worstCaseNumDays = MAX_NUM_LOGS_PER_ALCHEMY_REQUEST / worstCaseNumUpdateLogsPerDay;
      const safeNumBlocks = Math.round((worstCaseNumDays * secondsInDay) / APPROX_SECONDS_PER_BLOCK[chainId]);
      const numRequests = Math.ceil(MIN_NUM_DAYS_TO_FETCH / worstCaseNumDays);

      const volatilityOracle = new ethers.Contract(ALOE_II_ORACLE_ADDRESS[chainId], volatilityOracleAbi, provider);
      // Make requests
      const requests: Promise<ethers.Event[]>[] = [];
      for (let i = numRequests; i > 0; i -= 1) {
        requests.push(
          volatilityOracle.queryFilter(
            volatilityOracle.filters.Update(),
            currentBlockNumber - safeNumBlocks * i,
            currentBlockNumber - safeNumBlocks * (i - 1)
          )
        );
      }

      // Flatten into one big `logs` array and parse out into a pool-specific `map`
      const logs = (await Promise.all(requests)).flat();
      const map = new Map<Address, ethers.Event[]>();
      for (const log of logs) {
        if (log.removed || log.args === undefined) continue;

        const pool = log.args['pool'].toLowerCase();
        if (map.has(pool)) {
          map.get(pool)!.push(log);
        } else {
          map.set(pool, [log]);
        }
      }
      setOracleLogs(map);
    })();
  }, [provider, lendingPairs, setOracleLogs, blockNumber /* just here to trigger refetch */]);

  // Fetch `blockNumbersToTimestamps`
  useEffect(() => {
    (async () => {
      const blockNumbers = new Set<number>();
      let oldestBlockNumber = Infinity;
      // Include block numbers for each pool's latest `Update`, while also searching for oldest one
      oracleLogs.forEach((value) => {
        if (value.length === 0) return;
        blockNumbers.add(value.at(-1)!.blockNumber);
        oldestBlockNumber = Math.min(oldestBlockNumber, value[0].blockNumber);
      });
      // Include `oldestBlockNumber`
      if (oldestBlockNumber !== Infinity) blockNumbers.add(oldestBlockNumber);
      // Fetch times
      const map = new Map<number, number>();
      await Promise.all(
        Array.from(blockNumbers).map(async (blockNumber) => {
          map.set(blockNumber, (await provider.getBlock(blockNumber)).timestamp);
        })
      );
      setBlockNumbersToTimestamps(map);
    })();
  }, [provider, oracleLogs, setBlockNumbersToTimestamps]);

  // Compute `latestTimestamps` for table
  const latestTimestamps = useMemo(() => {
    return lendingPairs.map((pair) => {
      // If we're still fetching logs, `latestTimestamp` is undefined
      if (oracleLogs.size === 0) return undefined;
      // Once logs are fetched, lack of an entry means the Oracle has never been updated for this pair
      const logs = oracleLogs.get(pair.uniswapPool);
      if (logs === undefined || logs.length === 0) return -1;
      // Otherwise, return val depends on whether `blockNumbersToTimestamps` has loaded.
      // If it has, we return a proper timestamp; if not, return undefined.
      const blockNumber = logs[logs.length - 1].blockNumber;
      return blockNumbersToTimestamps.get(blockNumber);
    });
  }, [lendingPairs, oracleLogs, blockNumbersToTimestamps]);

  // Compute graph data
  const graphData: InfoGraphData | undefined = useMemo(() => {
    if (blockNumbersToTimestamps.size === 0) return undefined;

    // It's not feasible to fetch the exact `block.timestamp` for every log,
    // so we do some math here to set up a `approxTime` function. It pretends that
    // blocks are evenly spaced along our time axis, which is nearly true on these
    // timescales.
    let minBlockNumber = Infinity;
    let maxBlockNumber = -Infinity;
    blockNumbersToTimestamps.forEach((v, k) => {
      if (k < minBlockNumber) minBlockNumber = k;
      if (k > maxBlockNumber) maxBlockNumber = k;
    });
    const minTime = blockNumbersToTimestamps.get(minBlockNumber)!;
    const maxTime = blockNumbersToTimestamps.get(maxBlockNumber)!;
    const slope = (maxTime - minTime) / (maxBlockNumber - minBlockNumber);
    const approxTime = (blockNumber: number) => {
      return slope * (blockNumber - minBlockNumber) + minTime;
    };

    // Populate a map from market labels (e.g. 'USDC/WETH') to data points
    const map = new Map<InfoGraphLabel, { x: Date; ltv: number }[]>();
    oracleLogs.forEach((logs, uniswapPool) => {
      const pair = lendingPairs.find((pair) => pair.uniswapPool === uniswapPool);
      if (pair === undefined) return;
      const points = logs.map((log) => ({
        x: new Date(1000 * approxTime(log.blockNumber)),
        ltv: computeLTV(GN.fromBigNumber(log.args!['iv'], 12).toNumber(), pair.factoryData.nSigma),
      }));
      map.set(`${pair.token0.symbol}/${pair.token1.symbol}`, points);
    });

    return map;
  }, [blockNumbersToTimestamps, oracleLogs, lendingPairs]);

  // Populate a map from market labels (e.g. 'USDC/WETH') to token colors
  const graphColors: InfoGraphColors = useMemo(() => {
    const map: InfoGraphColors = new Map();
    lendingPairs.forEach((pair) => {
      if (!tokenColors.has(pair.token0.address) || !tokenColors.has(pair.token1.address)) return;
      map.set(`${pair.token0.symbol}/${pair.token1.symbol}`, {
        color0: `rgb(${tokenColors.get(pair.token0.address)!})`,
        color1: `rgb(${tokenColors.get(pair.token1.address)!})`,
      });
    });
    return map;
  }, [lendingPairs, tokenColors]);

  return (
    <div className='flex flex-col gap-4 lg:flex-row'>
      <StatsTable
        rows={lendingPairs.map((lendingPair, i) => ({
          lendingPair,
          lastUpdatedTimestamp: latestTimestamps.at(i),
          setPendingTxn,
          onMouseEnter: setHoveredPair,
        }))}
      />
      <InfoGraph graphData={graphData} graphColors={graphColors} hoveredPair={hoveredPair} />
    </div>
  );
}
