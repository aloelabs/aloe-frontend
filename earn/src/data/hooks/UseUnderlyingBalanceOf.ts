import { useContext, useEffect, useState } from 'react';

import Big from 'big.js';
import { lenderAbi } from 'shared/lib/abis/Lender';
import { Token } from 'shared/lib/data/Token';
import { Address, useContractRead } from 'wagmi';

import { ChainContext } from '../../App';

export function useBalanceOfUnderlying(
  token: Token,
  lender: Address,
  accountAddress: Address
): { refetch: () => void; data: string | null } {
  const { activeChain } = useContext(ChainContext);
  const [state, setState] = useState<string | null>(null);
  const { refetch, data: balanceOfUnderlying } = useContractRead({
    address: lender,
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
