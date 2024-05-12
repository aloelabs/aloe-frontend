import { useEffect, useState } from 'react';

import Big from 'big.js';
import { lenderAbi } from 'shared/lib/abis/Lender';
import { Token } from 'shared/lib/data/Token';
import { Address } from 'viem';
import { useReadContract } from 'wagmi';

export function useBalanceOfUnderlying(
  token: Token,
  lender: Address,
  accountAddress: Address
): { refetch: () => void; data: string | null } {
  const [state, setState] = useState<string | null>(null);
  const { refetch, data: balanceOfUnderlying } = useReadContract({
    address: lender,
    abi: lenderAbi,
    functionName: 'underlyingBalance',
    args: [accountAddress] as const,
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
