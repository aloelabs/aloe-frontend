import React, { useEffect, useState } from 'react';
import { useContext } from 'react';

import { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import AppPage from 'shared/lib/components/common/AppPage';
import { OutlinedWhiteButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { Address, useAccount, useContract, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import KittyLensAbi from '../assets/abis/KittyLens.json';
import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import BorrowGraph, { BorrowGraphData } from '../components/borrow/BorrowGraph';
import { MetricCard, HorizontalMetricCard, HealthMetricCard } from '../components/borrow/BorrowMetrics';
import GlobalStatsTable from '../components/borrow/GlobalStatsTable';
import SmartWalletButton, { NewSmartWalletButton } from '../components/borrow/SmartWalletButton';
import {
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_KITTY_LENS_ADDRESS,
  ALOE_II_ORACLE,
} from '../data/constants/Addresses';
import { RESPONSIVE_BREAKPOINT_MD } from '../data/constants/Breakpoints';
import { TOPIC0_CREAET_MARKET_EVENT, TOPIC0_IV } from '../data/constants/Signatures';
import {
  fetchMarginAccount,
  fetchMarginAccountPreviews,
  fetchMarketInfoFor,
  MarginAccount,
  MarginAccountPreview,
  MarketInfo,
} from '../data/MarginAccount';
import { makeEtherscanRequest } from '../util/Etherscan';
import { formatTokenAmount, roundPercentage } from '../util/Numbers';

const BORROW_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const Container = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 64px;
`;

const PageGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto;
  grid-template-areas:
    'monitor graph'
    'metrics metrics'
    'stats stats';
  flex-grow: 1;
  margin-top: 38px;
`;

const SmartWalletsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const MonitorContainer = styled.div`
  grid-area: monitor;
  margin-bottom: 64px;
`;

const GraphContainer = styled.div`
  grid-area: graph;
  margin-bottom: 64px;
`;

const StatsContainer = styled.div`
  grid-area: stats;
`;

const MetricsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  grid-area: metrics;
  margin-bottom: 64px;
`;

const MetricsTopGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  grid-column-gap: 16px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    grid-row-gap: 16px;
    grid-template-columns: 1fr 1fr;
  }
`;

const MetricsBottomGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1.5fr;
  grid-column-gap: 16px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    grid-row-gap: 16px;
    grid-template-columns: 1fr;
  }
`;

export type UniswapPoolInfo = {
  token0: Address;
  token1: Address;
  fee: number;
};

export default function BorrowPage() {
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider({ chainId: activeChain.id });
  const { address: userAddress } = useAccount();
  const [availablePools, setAvailablePools] = useState(new Map<string, UniswapPoolInfo>());
  const [graphData, setGraphData] = useState<BorrowGraphData[] | null>(null);
  const [marginAccountPreviews, setMarginAccountPreviews] = useState<MarginAccountPreview[] | null>(null);
  const [selectedMarginAccountPreview, setSelectedMarginAccountPreview] = useState<MarginAccountPreview | null>(null);
  const [cachedMarginAccounts, setCachedMarginAccounts] = useState<Map<string, MarginAccount>>(new Map());
  const [selectedMarginAccount, setSelectedMarginAccount] = useState<MarginAccount | null>(null);
  const [cachedMarketInfos, setCachedMarketInfos] = useState<Map<string, MarketInfo>>(new Map());
  const [selectedMarketInfo, setSelectedMarketInfo] = useState<MarketInfo | null>(null);
  const TOPIC1_PREFIX = '0x000000000000000000000000';

  const borrowerLensContract = useContract({
    abi: MarginAccountLensABI,
    address: ALOE_II_BORROWER_LENS_ADDRESS,
    signerOrProvider: provider,
  });

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (borrowerLensContract == null || userAddress === undefined || availablePools.size === 0) return;
      const marginAccountPreviews = await fetchMarginAccountPreviews(
        activeChain,
        borrowerLensContract,
        provider,
        userAddress,
        availablePools
      );
      if (mounted) {
        setMarginAccountPreviews(marginAccountPreviews);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [userAddress, activeChain, borrowerLensContract, provider, availablePools]);

  useEffect(() => {
    if (selectedMarginAccountPreview == null && marginAccountPreviews?.length) {
      setSelectedMarginAccountPreview(marginAccountPreviews[0]);
    }
  }, [marginAccountPreviews, selectedMarginAccountPreview]);

  useEffect(() => {
    let mounted = true;
    const cachedMarginAccount = cachedMarginAccounts.get(selectedMarginAccountPreview?.address ?? '');
    if (cachedMarginAccount != null) {
      setSelectedMarginAccount(cachedMarginAccount);
      return;
    }
    async function fetch() {
      if (selectedMarginAccountPreview == null || borrowerLensContract == null) return;
      const borrowerContract = new ethers.Contract(selectedMarginAccountPreview.address, MarginAccountABI, provider);
      const result = await fetchMarginAccount(
        selectedMarginAccountPreview.address,
        activeChain,
        borrowerContract,
        borrowerLensContract,
        provider,
        selectedMarginAccountPreview.address
      );
      if (mounted) {
        setCachedMarginAccounts((prev) => {
          return new Map(prev).set(selectedMarginAccountPreview.address, result.marginAccount);
        });
        setSelectedMarginAccount(result.marginAccount);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [selectedMarginAccountPreview, activeChain, borrowerLensContract, provider, userAddress, cachedMarginAccounts]);

  useEffect(() => {
    let mounted = true;

    async function fetchAvailablePools() {
      const result = await makeEtherscanRequest(
        0,
        ALOE_II_FACTORY_ADDRESS,
        [TOPIC0_CREAET_MARKET_EVENT],
        false,
        activeChain
      );
      const createMarketEvents = result.data.result;

      if (!Array.isArray(createMarketEvents)) return;

      const poolAddresses = createMarketEvents.map((e) => `0x${e.topics[1].slice(-40)}`);
      const poolInfoTuples = await Promise.all(
        poolAddresses.map((addr) => {
          const poolContract = new ethers.Contract(addr, UniswapV3PoolABI, provider);
          return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee()]);
        })
      );

      if (mounted)
        setAvailablePools(
          new Map(
            poolAddresses.map((addr, i) => {
              return [
                addr.toLowerCase(),
                {
                  token0: poolInfoTuples[i][0] as Address,
                  token1: poolInfoTuples[i][1] as Address,
                  fee: poolInfoTuples[i][2] as number,
                },
              ];
            })
          )
        );
    }

    fetchAvailablePools();
    return () => {
      mounted = false;
    };
  }, [activeChain, provider]);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      let etherscanResult: AxiosResponse<any, any> | null = null;
      if (selectedMarginAccountPreview == null) return;
      try {
        etherscanResult = await makeEtherscanRequest(
          0,
          ALOE_II_ORACLE,
          [TOPIC0_IV, `${TOPIC1_PREFIX}${selectedMarginAccountPreview?.uniswapPool}`],
          true,
          activeChain
        );
      } catch (e) {
        console.error(e);
      }
      if (etherscanResult == null || !Array.isArray(etherscanResult.data.result)) return [];
      const results = etherscanResult.data.result.map((result: any) => {
        const { data, timeStamp } = result;
        const decoded = ethers.utils.defaultAbiCoder.decode(['uint160', 'uint256'], data);
        const iv = ethers.BigNumber.from(decoded[1]).div(1e9).toNumber() / 1e9;
        const collateralFactor = Math.max(0.0948, Math.min((1 - 5 * iv) / 1.055, 0.9005));
        const convertedTimestamp = new Date(parseInt(timeStamp.toString()) * 1000).toISOString();
        const resultData: BorrowGraphData = {
          IV: iv * Math.sqrt(365),
          'Collateral Factor': collateralFactor,
          x: convertedTimestamp,
        };
        return resultData;
      });
      if (mounted) setGraphData(results);
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [activeChain, selectedMarginAccountPreview]);

  useEffect(() => {
    let mounted = true;
    const cachedMarketInfo = cachedMarketInfos.get(selectedMarginAccount?.address ?? '');
    if (cachedMarketInfo != null) {
      setSelectedMarketInfo(cachedMarketInfo);
      return;
    }
    async function fetch() {
      if (selectedMarginAccount == null) return;
      const lenderLensContract = new ethers.Contract(ALOE_II_KITTY_LENS_ADDRESS, KittyLensAbi, provider);
      const result = await fetchMarketInfoFor(
        lenderLensContract,
        selectedMarginAccount.lender0,
        selectedMarginAccount.lender1
      );
      if (mounted) {
        setCachedMarketInfos((prev) => {
          return new Map(prev).set(selectedMarginAccount.address, result);
        });
        setSelectedMarketInfo(result);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [selectedMarginAccount, provider, cachedMarketInfos]);

  const selectedMarginAccountIV = (selectedMarginAccount?.iv || 0) * Math.sqrt(365) * 100;
  const dailyIntest0 =
    ((selectedMarketInfo?.borrowerAPR0 || 0) / 365) * (selectedMarginAccountPreview?.liabilities.amount0 || 0);
  const dailyIntest1 =
    ((selectedMarketInfo?.borrowerAPR1 || 0) / 365) * (selectedMarginAccountPreview?.liabilities.amount1 || 0);
  return (
    <AppPage>
      <Container>
        <SmartWalletsContainer>
          <Text size='L' weight='bold' color={BORROW_TITLE_TEXT_COLOR}>
            Smart Wallets
          </Text>
          <div className='flex flex-col w-max gap-2'>
            {marginAccountPreviews?.map((preview) => (
              <SmartWalletButton
                token0={preview.token0}
                token1={preview.token1}
                isActive={selectedMarginAccountPreview?.address === preview.address}
                onClick={() => {
                  setSelectedMarginAccountPreview(preview);
                  setSelectedMarginAccount(cachedMarginAccounts.get(preview.address) ?? null);
                  setSelectedMarketInfo(cachedMarketInfos.get(preview.address) ?? null);
                }}
                key={preview.address}
              />
            ))}
            <NewSmartWalletButton onClick={() => {}} />
          </div>
        </SmartWalletsContainer>
        <PageGrid>
          <MonitorContainer>
            <Text size='XL' weight='bold'>
              <p>Monitor and manage</p>
              <p>your smart wallet</p>
            </Text>
            <div className='flex flex-col gap-2 w-max mt-4'>
              <OutlinedWhiteButtonWithIcon
                Icon={<PlusIcon />}
                position='leading'
                onClick={() => {}}
                size='S'
                svgColorType='stroke'
              >
                Add Collateral
              </OutlinedWhiteButtonWithIcon>
              <OutlinedWhiteButtonWithIcon
                Icon={<PlusIcon />}
                position='leading'
                onClick={() => {}}
                size='S'
                svgColorType='stroke'
              >
                Remove Collateral
              </OutlinedWhiteButtonWithIcon>
              <OutlinedWhiteButtonWithIcon
                Icon={<PlusIcon />}
                position='leading'
                onClick={() => {}}
                size='S'
                svgColorType='stroke'
              >
                Borrow
              </OutlinedWhiteButtonWithIcon>
              <OutlinedWhiteButtonWithIcon
                Icon={<PlusIcon />}
                position='leading'
                onClick={() => {}}
                size='S'
                svgColorType='stroke'
              >
                Repay
              </OutlinedWhiteButtonWithIcon>
            </div>
          </MonitorContainer>
          <GraphContainer>{graphData && graphData.length > 0 && <BorrowGraph graphData={graphData} />}</GraphContainer>
          <MetricsContainer>
            <MetricsTopGrid>
              <MetricCard
                label={`${selectedMarginAccountPreview?.token0.ticker} Collateral`}
                value={formatTokenAmount(selectedMarginAccountPreview?.assets.token0Raw || 0, 3)}
              />
              <MetricCard
                label={`${selectedMarginAccountPreview?.token1.ticker} Collateral`}
                value={formatTokenAmount(selectedMarginAccountPreview?.assets.token1Raw || 0, 3)}
              />
              <MetricCard
                label={`${selectedMarginAccountPreview?.token0.ticker} Borrows`}
                value={formatTokenAmount(selectedMarginAccountPreview?.liabilities.amount0 || 0, 3)}
              />
              <MetricCard
                label={`${selectedMarginAccountPreview?.token1.ticker} Borrows`}
                value={formatTokenAmount(selectedMarginAccountPreview?.liabilities.amount1 || 0, 3)}
              />
              <MetricCard label='IV' value={`${roundPercentage(selectedMarginAccountIV, 2).toString()}%`} />
            </MetricsTopGrid>
            <MetricsBottomGrid>
              <HealthMetricCard health={selectedMarginAccountPreview?.health || 0} />
              <HorizontalMetricCard label='Liquidation Distance' value='±1020' />
              <HorizontalMetricCard
                label='Daily Interest'
                value={`${formatTokenAmount(dailyIntest0, 3)} ${
                  selectedMarginAccountPreview?.token0.ticker
                }, ${formatTokenAmount(dailyIntest1, 3)} ${selectedMarginAccountPreview?.token1.ticker}`}
              />
            </MetricsBottomGrid>
          </MetricsContainer>
          {selectedMarginAccountPreview && selectedMarketInfo && (
            <StatsContainer>
              <GlobalStatsTable
                token0={selectedMarginAccountPreview?.token0}
                token1={selectedMarginAccountPreview?.token1}
                marketInfo={selectedMarketInfo}
              />
            </StatsContainer>
          )}
        </PageGrid>
      </Container>
    </AppPage>
  );
}
