import { useEffect, useState } from 'react';

import Big from 'big.js';
import { useContractRead } from 'wagmi';

import KittyLensABI from '../../assets/abis/KittyLens.json';
import { ALOE_II_KITTY_LENS_ADDRESS } from '../constants/Addresses';
import { Kitty } from '../Kitty';
import { Token } from '../Token';

export function useAmountToShares(token: Token, kitty: Kitty, withdrawAmount: string) {
  const [state, setState] = useState<string | null>(null);
  const { data: amountOfShares } = useContractRead({
    address: ALOE_II_KITTY_LENS_ADDRESS,
    abi: KittyLensABI,
    functionName: 'amountToShares',
    args: [kitty.address, new Big(withdrawAmount || '0').mul(10 ** token.decimals).toFixed(0)] as const,
    watch: true,
  });
  useEffect(() => {
    if (amountOfShares) {
      setState(amountOfShares.toString());
    }
  }, [amountOfShares, kitty.decimals]);
  return state;
}
