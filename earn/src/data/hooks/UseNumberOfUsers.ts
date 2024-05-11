import { useEffect, useState } from 'react';

import { ethers } from 'ethers';

import { LendingPair } from '../LendingPair';

export default function useNumberOfUsers(
  provider: ethers.providers.JsonRpcProvider,
  selectedLendingPair: LendingPair,
  lendingPairLabel: string
) {
  const [numberOfUsers, setNumberOfUsers] = useState<number>(0);
  const [cachedData, setCachedData] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let mounted = true;
    const cachedResult = cachedData.get(lendingPairLabel);
    if (cachedResult) {
      setNumberOfUsers(cachedResult);
      return;
    }
    // Temporarily set the number of users to 0 while we fetch the number of users
    setNumberOfUsers(0);
    async function fetchNumberOfUsers() {
      let lender0Logs: ethers.providers.Log[] = [];
      let lender1Logs: ethers.providers.Log[] = [];
      try {
        [lender0Logs, lender1Logs] = await Promise.all([
          provider.getLogs({
            fromBlock: 0,
            toBlock: 'latest',
            address: selectedLendingPair.kitty0.address,
            topics: ['0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7'],
          }),
          provider.getLogs({
            fromBlock: 0,
            toBlock: 'latest',
            address: selectedLendingPair.kitty1.address,
            topics: ['0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7'],
          }),
        ]);
      } catch (error) {
        console.error(error);
      }
      if (lender0Logs.length === 0 && lender1Logs.length === 0) {
        return;
      }
      let uniqueUsers = new Set<string>();
      const logs = [...lender0Logs, ...lender1Logs];
      logs.forEach((log: ethers.providers.Log) => {
        if (log.topics.length < 3) return;
        const userAddress = `0x${log.topics[2].slice(26)}`;
        uniqueUsers.add(userAddress);
      });
      if (mounted) {
        setNumberOfUsers(uniqueUsers.size);
        setCachedData((cachedData) => {
          // TODO: Make this into a custom hook (and make it more efficient)
          return new Map(cachedData).set(lendingPairLabel, uniqueUsers.size);
        });
      }
    }
    fetchNumberOfUsers();
    return () => {
      mounted = false;
    };
  }, [selectedLendingPair, cachedData, lendingPairLabel, provider]);

  return numberOfUsers;
}
