import { useEffect, useState } from 'react';
import Big from 'big.js';
import { useAccount, useContractRead } from 'wagmi';
import { TokenData } from '../TokenData';
import KittyABI from '../../assets/abis/Kitty.json';
import KittyLensABI from '../../assets/abis/KittyLens.json';
import { ALOE_II_KITTY_LENS_ADDRESS } from '../constants/Addresses';

export type WithdrawState = {
  underlyingBalance: Big;
  sharesToWithdraw: Big;
}

export type WithdrawProps = {
  token: TokenData;
  kitty: TokenData;
  withdrawAmount: string;
}

export function useWithdraw(props: WithdrawProps) {
  const { token, kitty, withdrawAmount } = props;
  const [state, setState] = useState<WithdrawState | null>(null);
  const account = useAccount();
  const { data: amountToShares } = useContractRead({
    addressOrName: ALOE_II_KITTY_LENS_ADDRESS,
    contractInterface: KittyLensABI,
    functionName: 'amountToShares',
    args: [
      kitty.address,
      new Big(withdrawAmount || '0').times(10 ** token.decimals).toFixed(0),
    ],
    watch: true,
  });
  const { data: bOfU } = useContractRead({
    addressOrName: kitty.address,
    contractInterface: KittyABI,
    functionName: 'balanceOfUnderlying',
    args: [account.address],
    watch: true,
  });
  useEffect(() => {
    if (amountToShares && bOfU) {
      setState({
        underlyingBalance: new Big(bOfU.toString()).div(10 ** token.decimals),
        sharesToWithdraw: new Big(amountToShares.toString()).div(10 ** token.decimals),
      });
    }
  }, [amountToShares, bOfU, token.decimals]);
  return state;
}
