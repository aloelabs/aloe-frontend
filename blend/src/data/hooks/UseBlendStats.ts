import { useEffect, useState } from 'react';

import { useContract, useProvider, useBlockNumber } from 'wagmi';

import AloeBlendABI from '../../assets/abis/AloeBlend.json';
import ERC20ABI from '../../assets/abis/ERC20.json';
import SiloABI from '../../assets/abis/Silo.json';
import { BlendPoolStats, ResolveBlendStats } from '../BlendPoolDataResolver';
import { BlendPoolMarkers } from '../BlendPoolMarkers';

export function useBlendStats(poolData: BlendPoolMarkers) {
  const [blendStats, setBlendStats] = useState<BlendPoolStats | null>(null);
  const { data: blockNumberData } = useBlockNumber();

  const provider = useProvider();
  const blend = useContract({
    address: poolData.poolAddress,
    abi: AloeBlendABI,
    signerOrProvider: provider,
  });
  const silo0 = useContract({
    address: poolData.silo0Address,
    abi: SiloABI,
    signerOrProvider: provider,
  });
  const silo1 = useContract({
    address: poolData.silo1Address,
    abi: SiloABI,
    signerOrProvider: provider,
  });
  const token0 = useContract({
    address: poolData.token0Address,
    abi: ERC20ABI,
    signerOrProvider: provider,
  });
  const token1 = useContract({
    address: poolData.token1Address,
    abi: ERC20ABI,
    signerOrProvider: provider,
  });

  useEffect(() => {
    const collectStats = async () => {
      if (!(blend && silo0 && silo1 && token0 && token1)) return;
      const stats = await ResolveBlendStats(blend, silo0, silo1, token0, token1);
      setBlendStats(stats);
    };

    collectStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolData, blockNumberData]);

  return blendStats;
}
