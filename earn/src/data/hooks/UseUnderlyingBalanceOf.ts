import { useEffect, useState } from 'react';

import Big from 'big.js';
import { useContractRead } from 'wagmi';

import KittyABI from '../../assets/abis/Kitty.json';
import { Kitty } from '../Kitty';
import { Token } from '../Token';

export function useBalanceOfUnderlying(token: Token, kitty: Kitty, accountAddress: string) {
  const [state, setState] = useState<string | null>(null);
  const { data: balanceOfUnderlying } = useContractRead({
    address: kitty.address,
    abi: KittyABI,
    functionName: 'underlyingBalance',
    args: [accountAddress] as const,
    watch: true,
  });
  useEffect(() => {
    if (balanceOfUnderlying) {
      setState(new Big(balanceOfUnderlying.toString()).div(10 ** token.decimals).toString());
    }
  }, [balanceOfUnderlying, token.decimals]);
  return state;
}
