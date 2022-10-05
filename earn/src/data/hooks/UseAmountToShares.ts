import { useEffect, useState } from 'react';
import Big from 'big.js';
import { useContractRead } from 'wagmi';
import { TokenData } from '../TokenData';
import KittyLensABI from '../../assets/abis/KittyLens.json';
import { ALOE_II_KITTY_LENS_ADDRESS } from '../constants/Addresses';

export function useAmountToShares(token: TokenData, kitty: TokenData, withdrawAmount: string) {
  const [state, setState] = useState<string | null>(null);
  const { data: amountOfShares } = useContractRead({
    addressOrName: ALOE_II_KITTY_LENS_ADDRESS,
    contractInterface: KittyLensABI,
    functionName: 'amountToShares',
    args: [kitty.address, new Big(withdrawAmount || '0').mul(10 ** token.decimals).toFixed(0)],
    watch: true,
  });
  useEffect(() => {
    if (amountOfShares) {
      setState(amountOfShares.toString());
    }
  }, [amountOfShares, kitty.decimals]);
  return state;
}
