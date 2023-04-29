import { useContext, useEffect, useState } from 'react';

import Big from 'big.js';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import { useContractRead } from 'wagmi';

import { ChainContext } from '../../App';
import KittyABI from '../../assets/abis/Kitty.json';

export function useBalanceOfUnderlying(
  token: Token,
  kitty: Kitty,
  accountAddress: string
): { refetch: () => void; data: string | null } {
  const { activeChain } = useContext(ChainContext);
  const [state, setState] = useState<string | null>(null);
  const { refetch, data: balanceOfUnderlying } = useContractRead({
    address: kitty.address,
    abi: KittyABI,
    functionName: 'underlyingBalance',
    args: [accountAddress] as const,
    chainId: activeChain?.id,
  });
  useEffect(() => {
    if (balanceOfUnderlying) {
      setState(new Big(balanceOfUnderlying.toString()).div(10 ** token.decimals).toString());
    }
  }, [balanceOfUnderlying, token.decimals]);
  return {
    refetch,
    data: state,
  };
}
