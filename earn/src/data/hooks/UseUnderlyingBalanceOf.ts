import { useContext, useEffect, useState } from 'react';

import Big from 'big.js';
import { useContractRead } from 'wagmi';

import { ChainContext } from '../../App';
import KittyABI from '../../assets/abis/Kitty.json';
import { Kitty } from '../Kitty';
import { Token } from '../Token';

export function useBalanceOfUnderlying(token: Token, kitty: Kitty, accountAddress: string) {
  const { activeChain } = useContext(ChainContext);
  const [state, setState] = useState<string | null>(null);
  const { data: balanceOfUnderlying } = useContractRead({
    address: kitty.address,
    abi: KittyABI,
    functionName: 'underlyingBalance',
    args: [accountAddress] as const,
    chainId: activeChain?.id,
    watch: true,
    staleTime: 13_000,
  });
  useEffect(() => {
    if (balanceOfUnderlying) {
      setState(new Big(balanceOfUnderlying.toString()).div(10 ** token.decimals).toString());
    }
  }, [balanceOfUnderlying, token.decimals]);
  return state;
}
