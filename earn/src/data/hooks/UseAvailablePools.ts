import { useContext, useEffect } from 'react';

import { ethers } from 'ethers';
import { uniswapV3PoolAbi } from 'shared/lib/abis/UniswapV3Pool';
import { ALOE_II_FACTORY_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { getToken } from 'shared/lib/data/TokenData';
import { Address, useProvider } from 'wagmi';

import { ChainContext } from '../../App';
import { UNISWAP_POOL_DENYLIST } from '../constants/Addresses';
import { TOPIC0_CREATE_MARKET_EVENT } from '../constants/Signatures';
import { UniswapPoolInfo } from '../MarginAccount';

export default function useAvailablePools() {
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider();
  const [availablePools, setAvailablePools] = useChainDependentState(
    new Map<string, UniswapPoolInfo>(),
    activeChain.id
  );
  useEffect(() => {
    (async () => {
      // NOTE: Use chainId from provider instead of `activeChain.id` since one may update before the other
      // when rendering. We want to stay consistent to avoid fetching things from the wrong address.
      const chainId = (await provider.getNetwork()).chainId;
      let logs: ethers.providers.Log[] = [];
      try {
        logs = await provider.getLogs({
          fromBlock: 0,
          toBlock: 'latest',
          address: ALOE_II_FACTORY_ADDRESS[chainId],
          topics: [TOPIC0_CREATE_MARKET_EVENT],
        });
      } catch (e) {
        console.error(e);
      }

      const poolAddresses = logs
        .map((e) => `0x${e.topics[1].slice(-40)}`)
        .filter((addr) => {
          return !UNISWAP_POOL_DENYLIST.includes(addr.toLowerCase());
        });
      const poolInfoTuples = await Promise.all(
        poolAddresses.map((addr) => {
          const poolContract = new ethers.Contract(addr, uniswapV3PoolAbi, provider);
          return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee()]);
        })
      ); // TODO: multicall

      const poolInfoMap = new Map<string, UniswapPoolInfo>();
      poolAddresses.forEach((addr, i) => {
        const token0 = getToken(chainId, poolInfoTuples[i][0] as Address);
        const token1 = getToken(chainId, poolInfoTuples[i][1] as Address);
        const fee = poolInfoTuples[i][2] as number;
        if (token0 && token1) poolInfoMap.set(addr.toLowerCase(), { token0, token1, fee });
      });

      setAvailablePools(poolInfoMap);
    })();
  }, [provider, setAvailablePools]);

  return availablePools;
}
