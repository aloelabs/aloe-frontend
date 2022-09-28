import { useEffect, useState } from 'react';
import Big from 'big.js';
import { useContractRead } from 'wagmi';
import { TokenData } from '../TokenData';
import KittyLensABI from '../../assets/abis/KittyLens.json';
import { ALOE_II_KITTY_LENS_ADDRESS } from '../constants/Addresses';

export function useAmountToShares(token: TokenData, kitty: TokenData, withdrawAmount: string) {
  const [state, setState] = useState<string | null>(null);
  const { data: amountToShares } = useContractRead({
    addressOrName: ALOE_II_KITTY_LENS_ADDRESS,
    contractInterface: KittyLensABI,
    functionName: 'amountToShares',
    args: [kitty.address, new Big(withdrawAmount || '0').times(10 ** token.decimals).toFixed(0)],
    watch: true,
  });
  useEffect(() => {
    if (amountToShares) {
      setState(new Big(amountToShares.toString()).div(10 ** token.decimals).toFixed(0));
    }
  }, [amountToShares, token.decimals]);
  return state;
}
