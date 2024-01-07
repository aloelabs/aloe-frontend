export type LeaderboardEnsEntry = {
  name: string | null;
  lastChecked: number;
};

export type LeaderboardResponseEntry = {
  address: string;
  score: string;
  ens?: LeaderboardEnsEntry;
};
