import { useContext, useEffect, useState } from 'react';

import Big from 'big.js';
import { lenderAbi } from 'shared/lib/abis/Lender';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import { Address, useContractRead } from 'wagmi';

import { ChainContext } from '../../App';

export function useBalanceOfUnderlying(
  token: Token,
  kitty: Kitty,
  accountAddress: Address
): { refetch: () => void; data: string | null } {
  const { activeChain } = useContext(ChainContext);
  const [state, setState] = useState<string | null>(null);
  const { refetch, data: balanceOfUnderlying } = useContractRead({
    address: kitty.address,
    abi: lenderAbi,
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
