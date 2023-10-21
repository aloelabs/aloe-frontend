import { Fragment, useContext, useEffect, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { lenderABI } from 'shared/lib/abis/Lender';
import { UniswapV3PoolABI } from 'shared/lib/abis/UniswapV3Pool';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import AppPage from 'shared/lib/components/common/AppPage';
import {
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
  MULTICALL_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { Q32 } from 'shared/lib/data/constants/Values';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { GN } from 'shared/lib/data/GoodNumber';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import styled from 'styled-components';
import { Address, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import PendingTxnModal, { PendingTxnModalStatus } from '../components/common/PendingTxnModal';
import LenderCard from '../components/info/LenderCard';
import MarketCard from '../components/info/MarketCard';
import { UNISWAP_POOL_DENYLIST } from '../data/constants/Addresses';
import { TOPIC0_CREATE_MARKET_EVENT, TOPIC0_UPDATE_ORACLE } from '../data/constants/Signatures';
import { ALOE_II_LIQUIDATION_INCENTIVE, ALOE_II_MAX_LEVERAGE } from '../data/constants/Values';
import { ContractCallReturnContextEntries, convertBigNumbersForReturnContexts } from '../util/Multicall';

type AloeMarketInfo = {
  lenders: [Address, Address];
  lenderSymbols: [string, string];
  lenderDecimals: [number, number];
  lenderRateModels: [Address, Address];
  lenderReserveFactors: [number, number];
  lenderTotalSupplies: [GN, GN];
  nSigma: number;
  iv: number;
  ltv: number;
  ante: GN;
  pausedUntilTime: number;
  manipulationMetric: number;
  manipulationThreshold: number;
  feeTier: FeeTier;
  lastUpdatedTimestamp?: number;
};

type LenderInfo = {
  reserveFactor: number;
  rateModel: Address;
  symbol: string;
  decimals: number;
  totalSupply: GN;
};

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: max-content max-content max-content;
  gap: 0px;
  row-gap: 32px;
  width: 100%;
  justify-content: safe center;
  margin-left: auto;
  overflow: auto;
`;

export default function InfoPage() {
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider({ chainId: activeChain.id });
  const [pendingTxn, setPendingTxn] = useState<SendTransactionResult | null>(null);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useState(false);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);
  const [poolInfo, setPoolInfo] = useChainDependentState<Map<Address, AloeMarketInfo> | undefined>(
    undefined,
    activeChain.id
  );
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      if (!pendingTxn) return;
      setPendingTxnModalStatus(PendingTxnModalStatus.PENDING);
      setIsPendingTxnModalOpen(true);
      const receipt = await pendingTxn.wait();
      if (receipt.status === 1) {
        setPendingTxnModalStatus(PendingTxnModalStatus.SUCCESS);
      } else {
        setPendingTxnModalStatus(PendingTxnModalStatus.FAILURE);
      }
    })();
  }, [pendingTxn, setIsPendingTxnModalOpen, setPendingTxnModalStatus]);

  useEffect(() => {
    (async () => {
      const chainId = (await provider.getNetwork()).chainId;

      // Fetch all the Aloe II markets
      let logs: ethers.providers.Log[] = [];
      try {
        logs = await provider.getLogs({
          fromBlock: 0,
          toBlock: 'latest',
          address: ALOE_II_FACTORY_ADDRESS[chainId],
          topics: [TOPIC0_CREATE_MARKET_EVENT],
        });
      } catch (e) {
        console.error(e);
      }

      // Get all of the lender addresses from the logs
      const lenderAddresses = logs.map((log) => {
        return ethers.utils.defaultAbiCoder.decode(['address', 'address'], log.data);
      });

      // Get all of the pool addresses from the logs
      const poolAddresses = logs
        .map((e) => `0x${e.topics[1].slice(-40)}` as Address)
        .filter((addr) => {
          return !UNISWAP_POOL_DENYLIST.includes(addr.toLowerCase());
        });

      const multicall = new Multicall({
        ethersProvider: provider,
        multicallCustomContractAddress: MULTICALL_ADDRESS[chainId],
        tryAggregate: true,
      });

      // Get all of the lender info
      const lenderCallContexts: ContractCallContext[] = [];

      lenderAddresses
        .flatMap((addr) => addr)
        .forEach((addr) => {
          lenderCallContexts.push({
            reference: addr,
            contractAddress: addr,
            abi: lenderABI as any,
            calls: [
              {
                reference: 'reserveFactor',
                methodName: 'reserveFactor',
                methodParameters: [],
              },
              {
                reference: 'rateModel',
                methodName: 'rateModel',
                methodParameters: [],
              },
              {
                reference: 'symbol',
                methodName: 'symbol',
                methodParameters: [],
              },
              {
                reference: 'decimals',
                methodName: 'decimals',
                methodParameters: [],
              },
              {
                reference: 'totalSupply',
                methodName: 'totalSupply',
                methodParameters: [],
              },
            ],
          });
        });

      const lenderCallResults = (await multicall.call(lenderCallContexts)).results;

      // Lender address -> Lender info
      const lenderResults: Map<string, LenderInfo> = new Map();

      Object.entries(lenderCallResults).forEach(([key, value]) => {
        const updatedCallsReturnContext = convertBigNumbersForReturnContexts(value.callsReturnContext);
        const reserveFactor = (1 / updatedCallsReturnContext[0].returnValues[0]) * 100;
        const rateModel = updatedCallsReturnContext[1].returnValues[0] as Address;
        const symbol = updatedCallsReturnContext[2].returnValues[0] as string;
        const decimals = updatedCallsReturnContext[3].returnValues[0] as number;
        const totalSupply = GN.fromBigNumber(
          updatedCallsReturnContext[4].returnValues[0] as ethers.BigNumber,
          decimals
        );

        lenderResults.set(key, {
          reserveFactor,
          rateModel,
          symbol,
          decimals,
          totalSupply,
        });
      });

      // Get all of the pool info
      const poolCallContexts: ContractCallContext[] = [];

      poolAddresses.forEach((addr) => {
        poolCallContexts.push({
          reference: `${addr}-uniswap`,
          contractAddress: addr,
          abi: UniswapV3PoolABI as any,
          calls: [
            {
              reference: 'fee',
              methodName: 'fee',
              methodParameters: [],
            },
          ],
        });
        poolCallContexts.push({
          reference: `${addr}-oracle`,
          contractAddress: ALOE_II_ORACLE_ADDRESS[chainId],
          abi: volatilityOracleAbi as any,
          calls: [
            {
              reference: 'consult',
              methodName: 'consult',
              methodParameters: [addr, Q32],
            },
          ],
        });
        poolCallContexts.push({
          reference: `${addr}-factory`,
          contractAddress: ALOE_II_FACTORY_ADDRESS[chainId],
          abi: factoryAbi as any,
          calls: [
            {
              reference: 'getParameters',
              methodName: 'getParameters',
              methodParameters: [addr],
            },
          ],
        });
      });

      const poolCallResults = (await multicall.call(poolCallContexts)).results;

      // Pool address -> Pool info
      const correspondingPoolResults: Map<string, ContractCallReturnContextEntries> = new Map();

      Object.entries(poolCallResults).forEach(([key, value]) => {
        const entryAccountAddress = key.split('-')[0];
        const entryType = key.split('-')[1];
        const existingValue = correspondingPoolResults.get(entryAccountAddress);
        if (existingValue) {
          existingValue[entryType] = value;
        } else {
          correspondingPoolResults.set(entryAccountAddress, { [entryType]: value });
        }
      });

      // Get the time at which each pool was last updated via the oracle (using the update event and getLogs)
      let updateLogs: ethers.providers.Log[] = [];
      try {
        updateLogs = await provider.getLogs({
          address: ALOE_II_ORACLE_ADDRESS[chainId],
          topics: [TOPIC0_UPDATE_ORACLE],
          fromBlock: 0,
          toBlock: 'latest',
        });
      } catch (e) {
        console.error(e);
      }
      const reversedLogs = updateLogs.filter((log) => log.removed === false).reverse();
      const latestTimestamps = await Promise.all(
        poolAddresses.map(async (addr) => {
          const latestUpdate = reversedLogs.find(
            (log) => log.topics[1] === `0x000000000000000000000000${addr.slice(2)}`
          );
          try {
            if (latestUpdate) {
              return (await provider.getBlock(latestUpdate.blockNumber)).timestamp;
            }
          } catch (e) {
            console.error(e);
          }
        })
      );

      const poolInfoMap = new Map<Address, AloeMarketInfo>();
      poolAddresses.forEach((addr, i) => {
        const lender0 = lenderAddresses[i][0] as Address;
        const lender1 = lenderAddresses[i][1] as Address;
        const lender0Info = lenderResults.get(lender0)!;
        const lender1Info = lenderResults.get(lender1)!;
        const poolResult = correspondingPoolResults.get(addr);
        const uniswapResult = poolResult?.uniswap?.callsReturnContext?.[0].returnValues;
        const oracleResult = convertBigNumbersForReturnContexts(poolResult?.oracle?.callsReturnContext ?? [])?.[0]
          .returnValues;
        const factoryResult = convertBigNumbersForReturnContexts(poolResult?.factory?.callsReturnContext ?? [])?.[0]
          .returnValues;

        // Uniswap parameters
        const feeTier = NumericFeeTierToEnum(uniswapResult?.[0] as number);

        // Factory parameters
        const ante = GN.fromBigNumber(factoryResult[0], 18);
        const nSigma = (factoryResult[1] as number) / 10;
        const manipulationThresholdDivisor = factoryResult[2] as number;
        const pausedUntilTime = factoryResult[3] as number;

        // Oracle results
        const manipulationMetric = ethers.BigNumber.from(oracleResult[0]).toNumber();
        const iv = ethers.BigNumber.from(oracleResult[2]).div(1e6).toNumber() / 1e6;

        // Stuff we can compute from other stuff
        let ltv = 1 / ((1 + 1 / ALOE_II_MAX_LEVERAGE + 1 / ALOE_II_LIQUIDATION_INCENTIVE) * Math.exp(nSigma * iv));
        ltv = Math.max(0.1, Math.min(ltv, 0.9));
        const manipulationThreshold = -Math.log(ltv) / Math.log(1.0001) / manipulationThresholdDivisor;

        const lastUpdatedTimestamp = latestTimestamps[i];

        poolInfoMap.set(addr, {
          lenders: [lender0, lender1],
          lenderSymbols: [lender0Info.symbol, lender1Info.symbol],
          lenderDecimals: [lender0Info.decimals, lender1Info.decimals],
          lenderRateModels: [lender0Info.rateModel, lender1Info.rateModel],
          lenderReserveFactors: [lender0Info.reserveFactor, lender1Info.reserveFactor],
          lenderTotalSupplies: [lender0Info.totalSupply, lender1Info.totalSupply],
          nSigma,
          iv: iv * Math.sqrt(365),
          ltv,
          ante,
          pausedUntilTime,
          manipulationMetric,
          manipulationThreshold,
          feeTier,
          lastUpdatedTimestamp,
        });
      });
      setPoolInfo(poolInfoMap);
    })();
  }, [provider, setPoolInfo]);

  return (
    <AppPage>
      <InfoGrid>
        {Array.from(poolInfo?.entries() ?? []).map(([addr, info]) => {
          return (
            <Fragment key={addr}>
              <MarketCard
                nSigma={info.nSigma}
                ltv={info.ltv}
                ante={info.ante}
                pausedUntilTime={info.pausedUntilTime}
                manipulationMetric={info.manipulationMetric}
                manipulationThreshold={info.manipulationThreshold}
                lenderSymbols={info.lenderSymbols}
                poolAddress={addr}
                feeTier={info.feeTier}
                lastUpdatedTimestamp={info.lastUpdatedTimestamp}
                setPendingTxn={setPendingTxn}
              />
              <LenderCard
                address={info.lenders[0]}
                symbol={info.lenderSymbols[0]}
                reserveFactor={info.lenderReserveFactors[0]}
                totalSupply={info.lenderTotalSupplies[0]}
                rateModel={info.lenderRateModels[0]}
                decimals={info.lenderDecimals[0]}
              />
              <LenderCard
                address={info.lenders[1]}
                symbol={info.lenderSymbols[1]}
                reserveFactor={info.lenderReserveFactors[1]}
                totalSupply={info.lenderTotalSupplies[1]}
                rateModel={info.lenderRateModels[1]}
                decimals={info.lenderDecimals[1]}
              />
            </Fragment>
          );
        })}
      </InfoGrid>
      <PendingTxnModal
        isOpen={isPendingTxnModalOpen}
        txnHash={pendingTxn?.hash}
        setIsOpen={(isOpen: boolean) => {
          setIsPendingTxnModalOpen(isOpen);
          if (!isOpen) {
            setPendingTxn(null);
          }
        }}
        onConfirm={() => {
          setIsPendingTxnModalOpen(false);
          setTimeout(() => {
            navigate(0);
          }, 100);
        }}
        status={pendingTxnModalStatus}
      />
    </AppPage>
  );
}
