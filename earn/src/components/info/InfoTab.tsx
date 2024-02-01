import { useEffect } from 'react';

import { SendTransactionResult, Provider } from '@wagmi/core';
import { ethers } from 'ethers';
import { ALOE_II_ORACLE_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';

import { TOPIC0_UPDATE_ORACLE } from '../../data/constants/Signatures';
import { LendingPair } from '../../data/LendingPair';
import StatsTable from './StatsTable';

export type InfoTabProps = {
  // Alternatively, could get these 2 from `ChainContext` and `useProvider`, respectively
  chainId: number;
  provider: Provider;
  // Remaining 3 should be passed in for sure though
  blockNumber: number | undefined;
  lendingPairs: LendingPair[];
  setPendingTxn: (data: SendTransactionResult) => void;
};

export default function InfoTab(props: InfoTabProps) {
  const { chainId, provider, blockNumber, lendingPairs, setPendingTxn } = props;

  const [latestTimestamps, setLatestTimestamps] = useChainDependentState<(number | undefined)[]>([], chainId);

  useEffect(() => {
    (async () => {
      const chainId = (await provider.getNetwork()).chainId;

      // Get the time at which each pool was last updated via the oracle (using the update event and getLogs)
      let updateLogs: ethers.providers.Log[] = [];
      try {
        updateLogs = await provider.getLogs({
          address: ALOE_II_ORACLE_ADDRESS[chainId],
          topics: [TOPIC0_UPDATE_ORACLE],
          fromBlock: 0,
          toBlock: 'latest',
        });
      } catch (e) {
        console.error(e);
      }
      const logs = updateLogs.filter((log) => log.removed === false).reverse();
      const latestUpdateBlockNumbers = lendingPairs.map(
        (pair) =>
          logs.find((log) => log.topics[1] === `0x000000000000000000000000${pair.uniswapPool.slice(2)}`)?.blockNumber
      );
      // --> Map block numbers to times
      const blockNumbersToTimestamps = new Map<number, number>();
      await Promise.all(
        Array.from(new Set(latestUpdateBlockNumbers)).map(async (blockNumber) => {
          if (blockNumber === undefined) return;
          blockNumbersToTimestamps.set(blockNumber, (await provider.getBlock(blockNumber)).timestamp);
        })
      );
      // --> Put it all together to get the most recent `Update` timestamps
      const newLatestTimestamps = latestUpdateBlockNumbers.map((blockNumber) => {
        if (blockNumber === undefined) return -1;
        return blockNumbersToTimestamps.get(blockNumber) || 0;
      });
      setLatestTimestamps(newLatestTimestamps);
    })();
  }, [provider, setLatestTimestamps, lendingPairs, blockNumber /* just here to trigger refetch */]);

  return (
    <StatsTable
      rows={lendingPairs.map((lendingPair, i) => ({
        lendingPair,
        lastUpdatedTimestamp: latestTimestamps.at(i),
        setPendingTxn,
      }))}
    />
  );
}
