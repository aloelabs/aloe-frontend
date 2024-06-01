import { useCallback, useEffect, useMemo, useState } from 'react';

import { Address } from 'viem';

import { LendingPair, asLendingPair } from '../data/LendingPair';
import useContractEvents from './UseContractEvents';
import { factoryAbi } from '../abis/Factory';
import {
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_LENDER_LENS_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
} from '../data/constants/ChainSpecific';
import { useReadContracts } from 'wagmi';
import { volatilityOracleAbi } from '../abis/VolatilityOracle';
import { Q32 } from '../data/constants/Values';
import { uniswapV3PoolAbi } from '../abis/UniswapV3Pool';
import { lenderLensAbi } from '../abis/LenderLens';
import { useQueryClient } from '@tanstack/react-query';

export function useLendingPairs(chainId: number) {
  const factory = {
    abi: factoryAbi,
    address: ALOE_II_FACTORY_ADDRESS[chainId],
    chainId,
  };
  const oracle = {
    abi: volatilityOracleAbi,
    address: ALOE_II_ORACLE_ADDRESS[chainId],
    chainId,
  };
  const lenderLens = {
    abi: lenderLensAbi,
    address: ALOE_II_LENDER_LENS_ADDRESS[chainId],
    chainId,
  };

  // Get `CreateMarket` events. Only refreshes on page load.
  const { data: logs, isFetching } = useContractEvents({
    ...factory,
    eventName: 'CreateMarket',
    strict: true,
  });

  const query = {
    enabled: !isFetching,
    staleTime: Infinity,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  } as const;

  // Get fee tier of each Uniswap pool that has a market. Only refreshes when `logs` changes.
  const { data: feeData } = useReadContracts({
    contracts: logs?.map(
      (log) =>
        ({
          abi: uniswapV3PoolAbi,
          address: log.args.pool,
          functionName: 'fee',
          chainId,
        } as const)
    ),
    allowFailure: false,
    query: {
      enabled: !isFetching,
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  // Get factory parameters for each market. Only refreshes on page load.
  const { data: getParametersData, queryKey: parametersKey } = useReadContracts({
    contracts: logs?.map(
      (log) =>
        ({
          ...factory,
          functionName: 'getParameters',
          args: [log.args.pool],
        } as const)
    ),
    allowFailure: false,
    query,
  });

  // Get instantaneous price and other oracle data for each market. Refreshes on page load and/or manually.
  const { data: oracleData, queryKey: oracleKey } = useReadContracts({
    contracts: logs
      ?.map((log) => [
        {
          abi: uniswapV3PoolAbi,
          address: log.args.pool,
          functionName: 'slot0',
          chainId,
        } as const,
        {
          ...oracle,
          functionName: 'consult',
          args: [log.args.pool, Q32], // TODO: bigint Q32
        } as const,
        {
          ...oracle,
          functionName: 'lastWrites',
          args: [log.args.pool],
        } as const,
      ])
      .flat(),
    allowFailure: false,
    query,
  });

  // Get main data for each market. Refreshes on page load and/or manually.
  const { data: readBasicsData, queryKey: readBasicsKey } = useReadContracts({
    contracts: [
      ...(logs?.map(
        (log) =>
          ({
            ...lenderLens,
            functionName: 'readBasics',
            args: [log.args.lender0],
          } as const)
      ) ?? []),
      ...(logs?.map(
        (log) =>
          ({
            ...lenderLens,
            functionName: 'readBasics',
            args: [log.args.lender1],
          } as const)
      ) ?? []),
    ],
    allowFailure: false,
    query,
  });

  const queryClient = useQueryClient();
  const refetchOracleData = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: oracleKey });
  }, [queryClient, oracleKey]);
  const refetchLenderData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: parametersKey });
    return queryClient.invalidateQueries({ queryKey: readBasicsKey });
  }, [queryClient, parametersKey, readBasicsKey]);

  const [data, setData] = useState<{ lendingPairs: LendingPair[]; chainId: number }>({
    lendingPairs: [],
    chainId: -1,
  });

  useEffect(() => {
    if (
      logs === undefined ||
      feeData === undefined ||
      getParametersData === undefined ||
      oracleData === undefined ||
      readBasicsData === undefined
    )
      return;

    let arr: LendingPair[] = [];
    logs.forEach((log, i) => {
      const fee = feeData[i];
      const getParameters = getParametersData[i];
      const slot0 = oracleData[i * 3] as readonly [bigint, number, number, number, number, number, boolean];
      const consult = oracleData[i * 3 + 1] as readonly [bigint, bigint, bigint];
      const lastWrites = oracleData[i * 3 + 2] as readonly [number, number, bigint, bigint];
      const readBasics0 = readBasicsData[i];
      const readBasics1 = readBasicsData[readBasicsData.length / 2 + i];

      const lendingPair = asLendingPair(
        chainId,
        log.args.pool,
        log.args.lender0,
        log.args.lender1,
        fee,
        getParameters,
        slot0,
        consult,
        lastWrites,
        readBasics0,
        readBasics1
      );
      if (lendingPair !== undefined) arr.push(lendingPair);
    });

    setData({
      lendingPairs: arr,
      chainId,
    });
  }, [chainId, logs, feeData, getParametersData, oracleData, readBasicsData]);

  const lendingPairs = useMemo(() => (chainId === data.chainId ? data.lendingPairs : []), [chainId, data]);

  return {
    lendingPairs,
    refetchOracleData,
    refetchLenderData,
  };
}

export function useLendingPair(lendingPairs: LendingPair[], pool?: Address, token0?: Address, token1?: Address) {
  return useMemo(() => {
    if (pool) {
      return lendingPairs.find((pair) => pool.toLowerCase() === pair.uniswapPool.toLowerCase());
    } else {
      return lendingPairs.find(
        (pair) =>
          pair.token0.address.toLowerCase() === token0?.toLowerCase() &&
          pair.token1.address.toLowerCase() === token1?.toLowerCase()
      );
    }
  }, [lendingPairs, pool, token0, token1]);
}
