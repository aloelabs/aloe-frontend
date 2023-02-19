import { useEffect, useState } from 'react';
import { useContext } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { Address, useAccount, useContract, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import KittyLensAbi from '../assets/abis/KittyLens.json';
import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import BorrowGraph, { BorrowGraphData } from '../components/borrow/BorrowGraph';
import { BorrowMetrics } from '../components/borrow/BorrowMetrics';
import GlobalStatsTable from '../components/borrow/GlobalStatsTable';
import ManageAccountButtons from '../components/borrow/ManageAccountButtons';
import AddCollateralModal from '../components/borrow/modal/AddCollateralModal';
import BorrowModal from '../components/borrow/modal/BorrowModal';
import NewSmartWalletModal from '../components/borrow/modal/NewSmartWalletModal';
import RemoveCollateralModal from '../components/borrow/modal/RemoveCollateralModal';
import RepayModal from '../components/borrow/modal/RepayModal';
import SmartWalletButton, { NewSmartWalletButton } from '../components/borrow/SmartWalletButton';
import { LABEL_TEXT_COLOR } from '../components/common/Modal';
import PendingTxnModal, { PendingTxnModalStatus } from '../components/common/PendingTxnModal';
import {
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_KITTY_LENS_ADDRESS,
  ALOE_II_ORACLE,
} from '../data/constants/Addresses';
import { RESPONSIVE_BREAKPOINT_MD, RESPONSIVE_BREAKPOINT_SM } from '../data/constants/Breakpoints';
import { TOPIC0_CREATE_MARKET_EVENT, TOPIC0_IV } from '../data/constants/Signatures';
import {
  fetchMarginAccount,
  fetchMarginAccountPreviews,
  fetchMarketInfoFor,
  MarginAccount,
  MarginAccountPreview,
  MarketInfo,
} from '../data/MarginAccount';
import { Token } from '../data/Token';
import { getToken } from '../data/TokenData';
import { makeEtherscanRequest } from '../util/Etherscan';

const BORROW_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const TOPIC1_PREFIX = '0x000000000000000000000000';

const Container = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 64px;
  max-width: 1280px;
  margin: 0 auto;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    gap: 32px;
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    flex-direction: column;
    gap: 0;
    align-items: center;
  }
`;

const PageGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  grid-template-rows: auto auto auto;
  grid-template-areas:
    'monitor graph'
    'metrics metrics'
    'stats stats';
  flex-grow: 1;
  margin-top: 26px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    width: 100%;
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto auto;
    grid-template-areas:
      'monitor'
      'graph'
      'metrics'
      'stats';
  }
`;

const SmartWalletsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    width: 100%;
  }
`;

const SmartWalletsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: max-content;
  min-width: 280px;
`;

const MonitorContainer = styled.div`
  grid-area: monitor;
  margin-bottom: 64px;
  display: flex;
  flex-direction: column;
  gap: 32px;
`;

const GraphContainer = styled.div`
  grid-area: graph;
  margin-bottom: 64px;
`;

const StatsContainer = styled.div`
  grid-area: stats;
`;

const MetricsContainer = styled.div`
  grid-area: metrics;
  margin-bottom: 64px;
`;

export type UniswapPoolInfo = {
  token0: Token;
  token1: Token;
  fee: number;
};

export default function BorrowPage() {
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider({ chainId: activeChain.id });
  const { address: userAddress } = useAccount();
  const [availablePools, setAvailablePools] = useState(new Map<string, UniswapPoolInfo>());
  const [graphData, setGraphData] = useState<BorrowGraphData[] | null>(null);
  const [marginAccountPreviews, setMarginAccountPreviews] = useState<MarginAccountPreview[] | null>(null);
  const [selectedMarginAccountPreview, setSelectedMarginAccountPreview] = useState<MarginAccountPreview | undefined>(
    undefined
  );
  const [cachedMarginAccounts, setCachedMarginAccounts] = useState<Map<string, MarginAccount>>(new Map());
  const [selectedMarginAccount, setSelectedMarginAccount] = useState<MarginAccount | undefined>(undefined);
  const [cachedMarketInfos, setCachedMarketInfos] = useState<Map<string, MarketInfo>>(new Map());
  const [selectedMarketInfo, setSelectedMarketInfo] = useState<MarketInfo | undefined>(undefined);
  const [newSmartWalletModalOpen, setNewSmartWalletModalOpen] = useState(false);
  const [isAddCollateralModalOpen, setIsAddCollateralModalOpen] = useState(false);
  const [isRemoveCollateralModalOpen, setIsRemoveCollateralModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useState(false);
  const [pendingTxn, setPendingTxn] = useState<SendTransactionResult | null>(null);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);

  const navigate = useNavigate();

  const borrowerLensContract = useContract({
    abi: MarginAccountLensABI,
    address: ALOE_II_BORROWER_LENS_ADDRESS,
    signerOrProvider: provider,
  });

  // MARK: Fetch available pools
  useEffect(() => {
    let mounted = true;
    async function fetchAvailablePools() {
      const result = await makeEtherscanRequest(
        0,
        ALOE_II_FACTORY_ADDRESS,
        [TOPIC0_CREATE_MARKET_EVENT],
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
                  token0: getToken(activeChain.id, poolInfoTuples[i][0] as Address),
                  token1: getToken(activeChain.id, poolInfoTuples[i][1] as Address),
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

  // MARK: Fetch margin account previews
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

  // MARK: Fetch margin account
  useEffect(() => {
    let mounted = true;
    const cachedMarginAccount = cachedMarginAccounts.get(selectedMarginAccountPreview?.address ?? '');
    if (cachedMarginAccount !== undefined) {
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

  // MARK: Fetch market info
  useEffect(() => {
    let mounted = true;
    const cachedMarketInfo = cachedMarketInfos.get(selectedMarginAccount?.address ?? '');
    if (cachedMarketInfo !== undefined) {
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

  // MARK: Fetch GraphData
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
        const resultData: BorrowGraphData = {
          IV: iv * Math.sqrt(365) * 100,
          'Collateral Factor': collateralFactor * 100,
          x: new Date(parseInt(timeStamp.toString()) * 1000),
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
    async function waitForTxn() {
      if (!pendingTxn) return;
      setPendingTxnModalStatus(PendingTxnModalStatus.PENDING);
      setIsPendingTxnModalOpen(true);
      const receipt = await pendingTxn.wait();
      if (!mounted) return;
      if (receipt.status === 1) {
        setPendingTxnModalStatus(PendingTxnModalStatus.SUCCESS);
      } else {
        setPendingTxnModalStatus(PendingTxnModalStatus.FAILURE);
      }
    }
    waitForTxn();
    return () => {
      mounted = false;
    };
  }, [pendingTxn]);

  const defaultPool = availablePools.keys().next().value;

  const dailyInterest0 =
    ((selectedMarketInfo?.borrowerAPR0 || 0) / 365) * (selectedMarginAccountPreview?.liabilities.amount0 || 0);
  const dailyInterest1 =
    ((selectedMarketInfo?.borrowerAPR1 || 0) / 365) * (selectedMarginAccountPreview?.liabilities.amount1 || 0);
  return (
    <AppPage>
      <Container>
        <SmartWalletsContainer>
          <Text size='M' weight='bold' color={BORROW_TITLE_TEXT_COLOR}>
            Smart Wallets
          </Text>
          <SmartWalletsList>
            {marginAccountPreviews?.map((preview) => (
              <SmartWalletButton
                token0={preview.token0}
                token1={preview.token1}
                isActive={selectedMarginAccountPreview?.address === preview.address}
                onClick={() => {
                  setSelectedMarginAccountPreview(preview);
                  setSelectedMarginAccount(cachedMarginAccounts.get(preview.address) ?? undefined);
                  setSelectedMarketInfo(cachedMarketInfos.get(preview.address) ?? undefined);
                }}
                key={preview.address}
              />
            ))}
            <NewSmartWalletButton
              onClick={() => {
                setNewSmartWalletModalOpen(true);
              }}
            />
          </SmartWalletsList>
        </SmartWalletsContainer>
        <PageGrid>
          <MonitorContainer>
            <Text size='XXL' weight='bold'>
              <p>Monitor and manage</p>
              <p>your smart wallet</p>
            </Text>
            <ManageAccountButtons
              onAddCollateral={() => {
                setIsAddCollateralModalOpen(true);
              }}
              onRemoveCollateral={() => {
                setIsRemoveCollateralModalOpen(true);
              }}
              onBorrow={() => {
                setIsBorrowModalOpen(true);
              }}
              onRepay={() => {
                setIsRepayModalOpen(true);
              }}
            />
          </MonitorContainer>
          <GraphContainer>
            {graphData && graphData.length > 0 ? (
              <div>
                <BorrowGraph graphData={graphData} />
                <div className='text-center opacity-50 pl-8'>
                  <Text size='S' weight='regular' color={LABEL_TEXT_COLOR}>
                    <em>
                      IV comes from an on-chain oracle. It influences the current collateral factor, which impacts the
                      health of your account.
                    </em>
                  </Text>
                </div>
              </div>
            ) : null}
          </GraphContainer>
          <MetricsContainer>
            <BorrowMetrics
              marginAccountPreview={selectedMarginAccountPreview}
              dailyInterest0={dailyInterest0}
              dailyInterest1={dailyInterest1}
            />
          </MetricsContainer>
          <StatsContainer>
            <GlobalStatsTable marginAccountPreview={selectedMarginAccountPreview} marketInfo={selectedMarketInfo} />
          </StatsContainer>
        </PageGrid>
      </Container>
      {availablePools.size > 0 && (
        <NewSmartWalletModal
          availablePools={availablePools}
          defaultPool={defaultPool}
          isOpen={newSmartWalletModalOpen}
          setIsOpen={setNewSmartWalletModalOpen}
          setPendingTxn={setPendingTxn}
        />
      )}
      {selectedMarginAccount && selectedMarketInfo && (
        <>
          <AddCollateralModal
            marginAccount={selectedMarginAccount}
            marketInfo={selectedMarketInfo}
            isOpen={isAddCollateralModalOpen}
            setIsOpen={setIsAddCollateralModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <RemoveCollateralModal
            marginAccount={selectedMarginAccount}
            marketInfo={selectedMarketInfo}
            isOpen={isRemoveCollateralModalOpen}
            setIsOpen={setIsRemoveCollateralModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <BorrowModal
            marginAccount={selectedMarginAccount}
            marketInfo={selectedMarketInfo}
            isOpen={isBorrowModalOpen}
            setIsOpen={setIsBorrowModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <RepayModal
            marginAccount={selectedMarginAccount}
            isOpen={isRepayModalOpen}
            setIsOpen={setIsRepayModalOpen}
            setPendingTxn={setPendingTxn}
          />
        </>
      )}
      <PendingTxnModal
        isOpen={isPendingTxnModalOpen}
        setIsOpen={(isOpen: boolean) => {
          setIsPendingTxnModalOpen(isOpen);
          if (!isOpen) {
            setPendingTxn(null);
          }
        }}
        txnHash={pendingTxn?.hash}
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
