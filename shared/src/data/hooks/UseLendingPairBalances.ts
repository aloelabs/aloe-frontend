import { Address, zeroAddress } from 'viem';
import { LendingPair, LendingPairBalancesMap } from '../LendingPair';
import { lenderAbi } from '../../abis/Lender';
import { useAccount, useBalance, useReadContracts } from 'wagmi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GN } from '../GoodNumber';
import { useQueryClient } from '@tanstack/react-query';

export function useLendingPairsBalances(lendingPairs: LendingPair[], chainId: number, staleTime = 60 * 1_000) {
  const { address } = useAccount();

  const { data: ethBalance } = useBalance({
    address,
    chainId,
    query: {
      staleTime,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const [tokens, setTokens] = useState(new Map<Address, { decimals: number; type: 'asset' | 'lender' }>());

  useEffect(() => {
    const newTokens = new Map<Address, { decimals: number; type: 'asset' | 'lender' }>();
    let shouldUpdate = false;

    lendingPairs.forEach((pair) => {
      newTokens.set(pair.token0.address, { decimals: pair.token0.decimals, type: 'asset' });
      newTokens.set(pair.token1.address, { decimals: pair.token1.decimals, type: 'asset' });
      newTokens.set(pair.kitty0.address, { decimals: pair.kitty0.decimals, type: 'lender' });
      newTokens.set(pair.kitty1.address, { decimals: pair.kitty1.decimals, type: 'lender' });

      if (
        !tokens.has(pair.token0.address) ||
        !tokens.has(pair.token1.address) ||
        !tokens.has(pair.kitty0.address) ||
        !tokens.has(pair.kitty1.address)
      ) {
        shouldUpdate = true;
      }
    });

    if (shouldUpdate) setTokens(newTokens);
  }, [lendingPairs, tokens]);

  const contracts = useMemo(() => {
    return Array.from(tokens.entries()).map(
      ([k, v]) =>
        ({
          abi: lenderAbi,
          functionName: v.type === 'lender' ? 'underlyingBalance' : 'balanceOf',
          args: [address],
          chainId,
          address: k,
          __decimals: v.decimals, // extra custom context (NOT PART OF WAGMI ARGS)
        } as const)
    );
  }, [tokens, chainId, address]);

  const { data, queryKey } = useReadContracts({
    contracts,
    allowFailure: false,
    query: {
      enabled: address !== undefined,
      staleTime,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const balances = useMemo(() => {
    const balancesMap: LendingPairBalancesMap = new Map();

    balancesMap.set(zeroAddress, {
      value: GN.fromBigInt(ethBalance?.value ?? 0n, 18).toNumber(),
      gn: GN.fromBigInt(ethBalance?.value ?? 0n, 18),
      form: 'raw',
    });

    if (data) {
      contracts.forEach((contract, i) => {
        const gn = GN.fromBigInt(data[i], contract.__decimals);

        balancesMap.set(contract.address, {
          value: gn.toNumber(),
          gn,
          form: contract.functionName === 'underlyingBalance' ? 'underlying' : 'raw',
        });
      });
    }

    return balancesMap;
  }, [contracts, data, ethBalance?.value]);

  const queryClient = useQueryClient();

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    balances,
    refetch,
  };
}
