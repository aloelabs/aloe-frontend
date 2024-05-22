import { useCallback, useEffect, useMemo, useState } from 'react';

import { Address } from 'viem';

import { KittyInfo, LendingPair } from '../LendingPair';
import useContractEvents from './UseContractEvents';
import { factoryAbi } from '../../abis/Factory';
import {
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_LENDER_LENS_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
} from '../constants/ChainSpecific';
import { useReadContracts } from 'wagmi';
import { volatilityOracleAbi } from '../../abis/VolatilityOracle';
import { Q32 } from '../constants/Values';
import { uniswapV3PoolAbi } from '../../abis/UniswapV3Pool';
import { lenderLensAbi } from '../../abis/LenderLens';
import { NumericFeeTierToEnum } from '../FeeTier';
import { asFactoryData } from '../FactoryData';
import { asOracleData } from '../OracleData';
import { asSlot0Data } from '../Slot0Data';
import { GN } from '../GoodNumber';
import { getToken } from '../TokenData';
import { Kitty } from '../Kitty';
import { useQueryClient } from '@tanstack/react-query';

const SECONDS_IN_YEAR = 365n * 24n * 60n * 60n;

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
  const { data: getParametersData } = useReadContracts({
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
    queryClient.invalidateQueries({ queryKey: oracleKey });
  }, [queryClient, oracleKey]);
  const refetchLenderData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: readBasicsKey });
  }, [queryClient, readBasicsKey]);

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

      const token0 = getToken(chainId, readBasics0[0]);
      const token1 = getToken(chainId, readBasics1[0]);
      if (token0 == null || token1 == null) return;

      const kitty0 = new Kitty(
        chainId,
        log.args.lender0!,
        token0.decimals,
        `${token0.symbol}+`,
        `Aloe II ${token0.name}`,
        token0.logoURI,
        token0
      );
      const kitty1 = new Kitty(
        chainId,
        log.args.lender1!,
        token1.decimals,
        `${token1.symbol}+`,
        `Aloe II ${token1.name}`,
        token1.logoURI,
        token1
      );

      const borrowAPR0 = Number((readBasics0[1] * SECONDS_IN_YEAR) / 1_000_000n) / 1e6;
      const borrowAPR1 = Number((readBasics1[1] * SECONDS_IN_YEAR) / 1_000_000n) / 1e6;

      const totalAssets0 = GN.fromBigInt(readBasics0[3], token0.decimals);
      const totalAssets1 = GN.fromBigInt(readBasics1[3], token1.decimals);

      const totalBorrows0 = GN.fromBigInt(readBasics0[4], token0.decimals);
      const totalBorrows1 = GN.fromBigInt(readBasics1[4], token1.decimals);

      const totalSupply0 = GN.fromBigInt(readBasics0[5], kitty0.decimals);
      const totalSupply1 = GN.fromBigInt(readBasics1[5], kitty1.decimals);

      arr.push(
        new LendingPair(
          token0,
          token1,
          kitty0,
          kitty1,
          new KittyInfo(totalAssets0, totalBorrows0, totalSupply0, borrowAPR0, readBasics0[6]),
          new KittyInfo(totalAssets1, totalBorrows1, totalSupply1, borrowAPR1, readBasics0[6]),
          log.args.pool!,
          NumericFeeTierToEnum(fee),
          Number(readBasics0[7] / 1_000_000_000_000n) / 1e6, // rewardsRate0
          Number(readBasics1[7] / 1_000_000_000_000n) / 1e6, // rewardsRate1
          asFactoryData(getParameters),
          asOracleData(consult),
          asSlot0Data(slot0),
          new Date(lastWrites[1] * 1000) // lastWrite.time
        )
      );
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

export function useLendingPair(lendingPairs: LendingPair[], token0?: Address, token1?: Address) {
  return useMemo(
    () =>
      lendingPairs.find(
        (pair) =>
          pair.token0.address.toLowerCase() === token0?.toLowerCase() &&
          pair.token1.address.toLowerCase() === token1?.toLowerCase()
      ),
    [lendingPairs, token0, token1]
  );
}
