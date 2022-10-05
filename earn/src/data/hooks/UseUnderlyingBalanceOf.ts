import { useEffect, useState } from 'react';
import { useContractRead } from 'wagmi';
import { TokenData } from '../TokenData';
import KittyABI from '../../assets/abis/Kitty.json';
import Big from 'big.js';

export function useBalanceOfUnderlying(
  token: TokenData,
  kitty: TokenData,
  accountAddress: string
) {
  const [state, setState] = useState<string | null>(null);
  const { data: balanceOfUnderlying } = useContractRead({
    addressOrName: kitty.address,
    contractInterface: KittyABI,
    functionName: 'balanceOfUnderlying',
    args: [accountAddress],
    watch: true,
  });
  useEffect(() => {
    if (balanceOfUnderlying) {
      setState(
        new Big(balanceOfUnderlying.toString())
          .div(10 ** token.decimals)
          .toString()
      );
    }
  }, [balanceOfUnderlying, token.decimals]);
  return state;
}
