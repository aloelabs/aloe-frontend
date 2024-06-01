import axios, { AxiosResponse } from 'axios';
import { API_LEADERBOARD_URL } from '../data/constants/Values';
import { useQuery } from '@tanstack/react-query';
import { Address } from 'viem';
import { useMemo } from 'react';
import { GN } from '../data/GoodNumber';

export type LeaderboardEnsEntry = {
  name: string | null;
  lastChecked: number;
};

export type LeaderboardResponseEntry = {
  address: string;
  score: string;
  ens?: LeaderboardEnsEntry;
};

export function useLeaderboard(refetchInterval = 10 * 60 * 1_000) {
  const queryFn = async () => {
    const response: AxiosResponse<LeaderboardResponseEntry[]> = await axios.get(`${API_LEADERBOARD_URL}`);
    if (!response || !response.data) {
      throw new Error('Leaderboard API failed to respond.');
    }
    return response.data;
  };

  const queryKey = ['useLeaderboard'];

  return useQuery({
    queryKey,
    queryFn,
    staleTime: refetchInterval,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval,
    refetchIntervalInBackground: false,
    placeholderData: [],
    select(data) {
      return data.map((entry) => ({
        ...entry,
        score: new GN(entry.score, 18, 10),
      }));
    },
  });
}

export function useLeaderboardValue(address?: Address) {
  const { data: leaderboard } = useLeaderboard();

  return useMemo(() => {
    if (!address || !leaderboard) return GN.zero(18);
    const entry = leaderboard.find((x) => x.address.toLowerCase() === address.toLowerCase());
    return entry?.score ?? GN.zero(18);
  }, [leaderboard, address]);
}
