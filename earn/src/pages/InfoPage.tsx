import { useContext, useEffect } from 'react';

import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { ethers } from 'ethers';
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
import { Address, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import MarketCard from '../components/info/MarketCard';
import { UNISWAP_POOL_DENYLIST } from '../data/constants/Addresses';
import { TOPIC0_CREATE_MARKET_EVENT } from '../data/constants/Signatures';
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
  manipulationMetric: number;
  manipulationThreshold: number;
  feeTier: FeeTier;
};

type LenderInfo = {
  reserveFactor: number;
  rateModel: Address;
  symbol: string;
  decimals: number;
  totalSupply: GN;
};

export default function InfoPage() {
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider({ chainId: activeChain.id });
  const [poolInfo, setPoolInfo] = useChainDependentState<Map<Address, AloeMarketInfo> | undefined>(
    undefined,
    activeChain.id
  );
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

      const poolInfoMap = new Map<Address, AloeMarketInfo>();
      poolAddresses.forEach((addr, i) => {
        console.log();
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

        // Oracle results
        const manipulationMetric = ethers.BigNumber.from(oracleResult[0]).toNumber();
        const iv = ethers.BigNumber.from(oracleResult[2]).div(1e6).toNumber() / 1e6;

        // Stuff we can compute from other stuff
        let ltv = 1 / ((1 + 1 / ALOE_II_MAX_LEVERAGE + 1 / ALOE_II_LIQUIDATION_INCENTIVE) * Math.exp(nSigma * iv));
        ltv = Math.max(0.1, Math.min(ltv, 0.9));
        const manipulationThreshold = -Math.log(ltv) / Math.log(1.0001) / manipulationThresholdDivisor;

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
          manipulationMetric,
          manipulationThreshold,
          feeTier,
        });
      });
      setPoolInfo(poolInfoMap);
    })();
  }, [provider, setPoolInfo]);

  return (
    <AppPage>
      <div className='flex flex-col gap-4'>
        {Array.from(poolInfo?.entries() ?? []).map(([addr, info]) => {
          return (
            <div key={addr}>
              <MarketCard
                ante={info.ante}
                ltv={info.ltv}
                manipulationMetric={info.manipulationMetric}
                manipulationThreshold={info.manipulationThreshold}
                nSigma={info.nSigma}
                lenderSymbols={info.lenderSymbols}
                poolAddress={addr}
                feeTier={info.feeTier}
              />
            </div>
          );
        })}
      </div>
    </AppPage>
  );
}
