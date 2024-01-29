import { useContext, useEffect, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { ethers } from 'ethers';
import AppPage from 'shared/lib/components/common/AppPage';
import { ALOE_II_ORACLE_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { useBlockNumber, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import PendingTxnModal, { PendingTxnModalStatus } from '../components/common/PendingTxnModal';
import StatsTable from '../components/info/StatsTable';
import { TOPIC0_UPDATE_ORACLE } from '../data/constants/Signatures';
import { useLendingPairs } from '../data/hooks/UseLendingPairs';

export default function InfoPage() {
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider({ chainId: activeChain.id });
  const [pendingTxn, setPendingTxn] = useState<SendTransactionResult | null>(null);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useState(false);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);
  const [latestTimestamps, setLatestTimestamps] = useChainDependentState<(number | undefined)[]>([], activeChain.id);

  const { lendingPairs } = useLendingPairs();

  const { data: blockNumber, refetch } = useBlockNumber({
    chainId: activeChain.id,
  });

  useEffect(() => {
    (async () => {
      if (!pendingTxn) return;
      setPendingTxnModalStatus(PendingTxnModalStatus.PENDING);
      setIsPendingTxnModalOpen(true);
      const receipt = await pendingTxn.wait();
      if (receipt.status === 1) {
        setPendingTxnModalStatus(PendingTxnModalStatus.SUCCESS);
      } else {
        setPendingTxnModalStatus(PendingTxnModalStatus.FAILURE);
      }
    })();
  }, [pendingTxn, setIsPendingTxnModalOpen, setPendingTxnModalStatus]);

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
    <AppPage>
      <StatsTable
        rows={lendingPairs.map((lendingPair, i) => ({
          lendingPair,
          lastUpdatedTimestamp: latestTimestamps.at(i),
          setPendingTxn,
        }))}
      />
      <PendingTxnModal
        isOpen={isPendingTxnModalOpen}
        txnHash={pendingTxn?.hash}
        setIsOpen={(isOpen: boolean) => {
          setIsPendingTxnModalOpen(isOpen);
          if (!isOpen) {
            setPendingTxn(null);
          }
        }}
        onConfirm={() => {
          setIsPendingTxnModalOpen(false);
          setTimeout(() => refetch(), 100);
        }}
        status={pendingTxnModalStatus}
      />
    </AppPage>
  );
}
