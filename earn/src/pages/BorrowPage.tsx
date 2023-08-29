import { useEffect, useMemo, useState } from 'react';
import { useContext } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { useNavigate } from 'react-router-dom';
import AppPage from 'shared/lib/components/common/AppPage';
import { LABEL_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { base } from 'shared/lib/data/BaseChain';
import {
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_LENDER_LENS_ADDRESS,
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { GetNumericFeeTier } from 'shared/lib/data/FeeTier';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { useDebouncedEffect } from 'shared/lib/data/hooks/UseDebouncedEffect';
import useSafeState from 'shared/lib/data/hooks/UseSafeState';
import { Token } from 'shared/lib/data/Token';
import { getToken } from 'shared/lib/data/TokenData';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';
import styled from 'styled-components';
import { Address, useAccount, useContract, useProvider, useContractRead } from 'wagmi';

import { ChainContext } from '../App';
import KittyLensAbi from '../assets/abis/KittyLens.json';
import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { ReactComponent as InfoIcon } from '../assets/svg/info.svg';
import BorrowGraph, { BorrowGraphData } from '../components/borrow/BorrowGraph';
import { BorrowGraphPlaceholder } from '../components/borrow/BorrowGraphPlaceholder';
import { BorrowMetrics } from '../components/borrow/BorrowMetrics';
import GlobalStatsTable from '../components/borrow/GlobalStatsTable';
import ManageAccountButtons from '../components/borrow/ManageAccountButtons';
import AddCollateralModal from '../components/borrow/modal/AddCollateralModal';
import BorrowModal from '../components/borrow/modal/BorrowModal';
import NewSmartWalletModal from '../components/borrow/modal/NewSmartWalletModal';
import RemoveCollateralModal from '../components/borrow/modal/RemoveCollateralModal';
import RepayModal from '../components/borrow/modal/RepayModal';
import SmartWalletButton, { NewSmartWalletButton } from '../components/borrow/SmartWalletButton';
import { UniswapPositionList } from '../components/borrow/UniswapPositionList';
import PendingTxnModal, { PendingTxnModalStatus } from '../components/common/PendingTxnModal';
import { UNISWAP_POOL_DENYLIST } from '../data/constants/Addresses';
import { RESPONSIVE_BREAKPOINT_MD, RESPONSIVE_BREAKPOINT_SM } from '../data/constants/Breakpoints';
import { TOPIC0_CREATE_MARKET_EVENT, TOPIC0_IV } from '../data/constants/Signatures';
import { primeUrl } from '../data/constants/Values';
import { fetchMarginAccounts, MarginAccount } from '../data/MarginAccount';
import { fetchMarketInfoFor, MarketInfo } from '../data/MarketInfo';
import {
  fetchUniswapNFTPositions,
  fetchUniswapPositions,
  UniswapNFTPosition,
  UniswapPosition,
  UniswapPositionPrior,
} from '../data/Uniswap';
import { makeEtherscanRequest } from '../util/Etherscan';

const BORROW_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const TOPIC1_PREFIX = '0x000000000000000000000000';
const FETCH_UNISWAP_POSITIONS_DEBOUNCE_MS = 500;

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
  grid-template-rows: auto auto auto auto auto;
  grid-template-areas:
    'monitor graph'
    'metrics metrics'
    'uniswap uniswap'
    'stats stats'
    'link link';
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
      'uniswap'
      'stats'
      'link';
  }
`;

const StyledExternalLink = styled.a`
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 100%;
  &:hover {
    text-decoration: underline;
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

const MetricsContainer = styled.div`
  grid-area: metrics;
  margin-bottom: 64px;
`;

const UniswapPositionsContainer = styled.div`
  grid-area: uniswap;
  margin-bottom: 64px;
`;

const StatsContainer = styled.div`
  grid-area: stats;
`;

const LinkContainer = styled.div`
  grid-area: link;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
`;

export type UniswapPoolInfo = {
  token0: Token;
  token1: Token;
  fee: number;
};

export default function BorrowPage() {
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider({ chainId: activeChain.id });
  const { address: userAddress, isConnected } = useAccount();

  const [availablePools, setAvailablePools] = useChainDependentState(
    new Map<string, UniswapPoolInfo>(),
    activeChain.id
  );
  const [cachedGraphDatas, setCachedGraphDatas] = useSafeState<Map<string, BorrowGraphData[]>>(new Map());
  const [graphData, setGraphData] = useSafeState<BorrowGraphData[] | null>(null);
  const [marginAccounts, setMarginAccounts] = useChainDependentState<MarginAccount[] | null>(null, activeChain.id);
  const [selectedMarginAccount, setSelectedMarginAccount] = useChainDependentState<MarginAccount | undefined>(
    undefined,
    activeChain.id
  );
  const [cachedUniswapPositionsMap, setCachedUniswapPositionsMap] = useSafeState<
    Map<string, readonly UniswapPosition[]>
  >(new Map());
  const [isLoadingUniswapPositions, setIsLoadingUniswapPositions] = useSafeState(true);
  const [uniswapPositions, setUniswapPositions] = useSafeState<readonly UniswapPosition[]>([]);
  const [uniswapNFTPositions, setUniswapNFTPositions] = useSafeState<Map<number, UniswapNFTPosition>>(new Map());
  const [cachedMarketInfos, setCachedMarketInfos] = useSafeState<Map<string, MarketInfo>>(new Map());
  const [selectedMarketInfo, setSelectedMarketInfo] = useSafeState<MarketInfo | undefined>(undefined);
  const [newSmartWalletModalOpen, setNewSmartWalletModalOpen] = useState(false);
  const [isAddCollateralModalOpen, setIsAddCollateralModalOpen] = useState(false);
  const [isRemoveCollateralModalOpen, setIsRemoveCollateralModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useSafeState(false);
  const [pendingTxn, setPendingTxn] = useState<SendTransactionResult | null>(null);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useSafeState<PendingTxnModalStatus | null>(null);

  const navigate = useNavigate();

  const borrowerLensContract = useContract({
    abi: MarginAccountLensABI,
    address: ALOE_II_BORROWER_LENS_ADDRESS[activeChain.id],
    signerOrProvider: provider,
  });
  const { data: uniswapPositionTicks } = useContractRead({
    address: selectedMarginAccount?.address ?? '0x',
    abi: MarginAccountABI,
    functionName: 'getUniswapPositions',
    chainId: activeChain.id,
    enabled: !!selectedMarginAccount,
  });

  // MARK: Fetch available pools
  useEffect(() => {
    (async () => {
      // NOTE: Use chainId from provider instead of `activeChain.id` since one may update before the other
      // when rendering. We want to stay consistent to avoid fetching things from the wrong address.
      const chainId = (await provider.getNetwork()).chainId;
      let logs: ethers.providers.Log[] = [];
      try {
        // TODO: remove this once the RPC providers (preferably Alchemy) support better eth_getLogs on Base
        if (chainId === base.id) {
          const res = await makeEtherscanRequest(
            2284814,
            ALOE_II_FACTORY_ADDRESS[chainId],
            [TOPIC0_CREATE_MARKET_EVENT],
            true,
            chainId
          );
          logs = res.data.result;
        } else {
          logs = await provider.getLogs({
            fromBlock: 0,
            toBlock: 'latest',
            address: ALOE_II_FACTORY_ADDRESS[chainId],
            topics: [TOPIC0_CREATE_MARKET_EVENT],
          });
        }
      } catch (e) {
        console.error(e);
      }

      const poolAddresses = logs
        .map((e) => `0x${e.topics[1].slice(-40)}`)
        .filter((addr) => {
          return !UNISWAP_POOL_DENYLIST.includes(addr.toLowerCase());
        });
      const poolInfoTuples = await Promise.all(
        poolAddresses.map((addr) => {
          const poolContract = new ethers.Contract(addr, UniswapV3PoolABI, provider);
          return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee()]);
        })
      );

      const poolInfoMap = new Map<string, UniswapPoolInfo>();
      poolAddresses.forEach((addr, i) => {
        const token0 = getToken(chainId, poolInfoTuples[i][0] as Address);
        const token1 = getToken(chainId, poolInfoTuples[i][1] as Address);
        const fee = poolInfoTuples[i][2] as number;
        if (token0 && token1) poolInfoMap.set(addr.toLowerCase(), { token0, token1, fee });
      });

      setAvailablePools(poolInfoMap);
    })();
  }, [provider, setAvailablePools]);

  // MARK: Fetch margin accounts
  useEffect(() => {
    (async () => {
      if (borrowerLensContract == null || userAddress === undefined || availablePools.size === 0) return;
      const chainId = (await provider.getNetwork()).chainId;
      const fetchedMarginAccounts = await fetchMarginAccounts(chainId, provider, userAddress, availablePools);
      setMarginAccounts(fetchedMarginAccounts);
    })();
  }, [userAddress, borrowerLensContract, provider, availablePools, setMarginAccounts]);

  // If no margin account is selected, select the first one
  useEffect(() => {
    if (selectedMarginAccount == null && marginAccounts?.length) {
      setSelectedMarginAccount(marginAccounts[0]);
    }
  }, [marginAccounts, selectedMarginAccount, setSelectedMarginAccount]);

  // MARK: Fetch market info
  useEffect(() => {
    const cachedMarketInfo = cachedMarketInfos.get(selectedMarginAccount?.address ?? '');
    if (cachedMarketInfo !== undefined) {
      setSelectedMarketInfo(cachedMarketInfo);
      return;
    }
    (async () => {
      if (selectedMarginAccount == null) return;
      const lenderLensContract = new ethers.Contract(
        ALOE_II_LENDER_LENS_ADDRESS[activeChain.id],
        KittyLensAbi,
        provider
      );
      const result = await fetchMarketInfoFor(
        lenderLensContract,
        selectedMarginAccount.lender0,
        selectedMarginAccount.lender1,
        selectedMarginAccount.token0.decimals,
        selectedMarginAccount.token1.decimals
      );
      setCachedMarketInfos((prev) => {
        return new Map(prev).set(selectedMarginAccount.address, result);
      });
      setSelectedMarketInfo(result);
    })();
  }, [selectedMarginAccount, provider, cachedMarketInfos, activeChain.id, setSelectedMarketInfo, setCachedMarketInfos]);

  // MARK: Fetch GraphData
  useEffect(() => {
    const cachedGraphData = cachedGraphDatas.get(selectedMarginAccount?.address ?? '');
    if (cachedGraphData !== undefined) {
      setGraphData(cachedGraphData);
      return;
    }
    (async () => {
      let etherscanResult: AxiosResponse<any, any> | null = null;
      if (selectedMarginAccount == null) return;
      try {
        // TODO: make this into a dedicated function
        etherscanResult = await makeEtherscanRequest(
          0,
          ALOE_II_ORACLE_ADDRESS[activeChain.id],
          [TOPIC0_IV, `${TOPIC1_PREFIX}${selectedMarginAccount?.uniswapPool}`],
          true,
          activeChain.id
        );
      } catch (e) {
        console.error(e);
      }
      if (etherscanResult == null || !Array.isArray(etherscanResult.data.result)) return [];
      const results = etherscanResult.data.result.map((result: any) => {
        // TODO: abstract this out
        const { data, timeStamp } = result;
        const decoded = ethers.utils.defaultAbiCoder.decode(['uint160', 'uint256'], data);
        const iv = ethers.BigNumber.from(decoded[1]).div(1e12).toNumber() / 1e6;
        const collateralFactor = Math.max(0.0948, Math.min((1 - 5 * iv) / 1.055, 0.9005));
        const resultData: BorrowGraphData = {
          IV: iv * Math.sqrt(365) * 100,
          'Collateral Factor': collateralFactor * 100,
          x: new Date(parseInt(timeStamp.toString(), 16) * 1000),
        };
        return resultData;
      });
      setCachedGraphDatas((prev) => {
        return new Map(prev).set(selectedMarginAccount.address, results);
      });
      setGraphData(results);
    })();
  }, [activeChain, cachedGraphDatas, selectedMarginAccount, setCachedGraphDatas, setGraphData]);

  // MARK: Fetch Uniswap positions for this MarginAccount (debounced to avoid double-fetching)
  useDebouncedEffect(
    () => {
      setIsLoadingUniswapPositions(true);
      const cachedUniswapPositions = cachedUniswapPositionsMap.get(selectedMarginAccount?.address ?? '');
      if (cachedUniswapPositions !== undefined) {
        // If we have cached positions, set them and return (no need to fetch)
        setUniswapPositions(cachedUniswapPositions);
        setIsLoadingUniswapPositions(false);
        return;
      }
      (async () => {
        if (!Array.isArray(uniswapPositionTicks)) {
          setCachedUniswapPositionsMap((prev) => {
            return new Map(prev).set(selectedMarginAccount?.address ?? '', []);
          });
          setIsLoadingUniswapPositions(false);
          return;
        }

        // Convert the ticks into UniswapPositionPriors
        const uniswapPositionPriors: UniswapPositionPrior[] = [];
        for (let i = 0; i < uniswapPositionTicks.length; i += 2) {
          uniswapPositionPriors.push({
            lower: uniswapPositionTicks[i] as number,
            upper: uniswapPositionTicks[i + 1] as number,
          });
        }
        if (uniswapPositionPriors.length === 0 || selectedMarginAccount === undefined) {
          setCachedUniswapPositionsMap((prev) => {
            return new Map(prev).set(selectedMarginAccount?.address ?? '', []);
          });
          setIsLoadingUniswapPositions(false);
          return;
        }

        // Fetch the positions
        const fetchedUniswapPositionsMap = await fetchUniswapPositions(
          uniswapPositionPriors,
          selectedMarginAccount.address,
          selectedMarginAccount.uniswapPool,
          provider,
          activeChain
        );
        // We only want the values, not the keys
        const fetchedUniswapPositions = Array.from(fetchedUniswapPositionsMap.values());

        // Cache the positions
        setCachedUniswapPositionsMap((prev) => {
          return new Map(prev).set(selectedMarginAccount.address, fetchedUniswapPositions);
        });
        // Set the positions
        setUniswapPositions(fetchedUniswapPositions);
        setIsLoadingUniswapPositions(false);
      })();
    },
    FETCH_UNISWAP_POSITIONS_DEBOUNCE_MS,
    [uniswapPositionTicks]
  );

  useEffect(() => {
    (async () => {
      if (userAddress === undefined) return;
      const fetchedUniswapNFTPositions = await fetchUniswapNFTPositions(userAddress, provider);
      setUniswapNFTPositions(fetchedUniswapNFTPositions);
    })();
  }, [provider, setUniswapNFTPositions, userAddress]);

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

  const filteredNonZeroUniswapNFTPositions = useMemo(() => {
    const filteredPositions: Map<number, UniswapNFTPosition> = new Map();
    if (selectedMarginAccount == null) return filteredPositions;
    uniswapNFTPositions.forEach((position, tokenId) => {
      if (
        selectedMarginAccount.token0.equals(position.token0) &&
        selectedMarginAccount.token1.equals(position.token1) &&
        GetNumericFeeTier(selectedMarginAccount.feeTier) === position.fee &&
        JSBI.greaterThan(position.liquidity, JSBI.BigInt('0'))
      ) {
        filteredPositions.set(tokenId, position);
      }
    });
    return filteredPositions;
  }, [selectedMarginAccount, uniswapNFTPositions]);

  const withdrawableUniswapNFTPositions = useMemo(() => {
    const filteredPositions: Map<number, UniswapNFTPosition> = new Map();
    if (selectedMarginAccount == null) return filteredPositions;
    uniswapPositions.forEach((uniswapPosition) => {
      const isNonZero = JSBI.greaterThan(uniswapPosition.liquidity, JSBI.BigInt('0'));
      const matchingNFTPosition = Array.from(uniswapNFTPositions.entries()).find(([, position]) => {
        return position.lower === uniswapPosition.lower && position.upper === uniswapPosition.upper;
      });
      if (matchingNFTPosition !== undefined && isNonZero) {
        filteredPositions.set(matchingNFTPosition[0], matchingNFTPosition[1]);
      }
    });
    return filteredPositions;
  }, [selectedMarginAccount, uniswapPositions, uniswapNFTPositions]);

  const defaultPool = Array.from(availablePools.keys())[0];

  const dailyInterest0 =
    ((selectedMarketInfo?.borrowerAPR0 || 0) / 365) * (selectedMarginAccount?.liabilities.amount0 || 0);
  const dailyInterest1 =
    ((selectedMarketInfo?.borrowerAPR1 || 0) / 365) * (selectedMarginAccount?.liabilities.amount1 || 0);

  const baseEtherscanUrl = getEtherscanUrlForChain(activeChain);
  const selectedMarginAccountEtherscanUrl = `${baseEtherscanUrl}/address/${selectedMarginAccount?.address}`;

  return (
    <AppPage>
      <Container>
        <SmartWalletsContainer>
          <Text size='M' weight='bold' color={BORROW_TITLE_TEXT_COLOR}>
            Smart Wallets
          </Text>
          <SmartWalletsList>
            {marginAccounts?.map((account) => (
              <SmartWalletButton
                token0={account.token0}
                token1={account.token1}
                isActive={selectedMarginAccount?.address === account.address}
                onClick={() => {
                  // When a new account is selected, we need to update the
                  // selectedMarginAccount, selectedMarketInfo, and uniswapPositions
                  setSelectedMarginAccount(account);
                  setSelectedMarketInfo(cachedMarketInfos.get(account.address) ?? undefined);
                  setUniswapPositions(cachedUniswapPositionsMap.get(account.address) ?? []);
                }}
                key={account.address}
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
                if (isConnected) setIsAddCollateralModalOpen(true);
              }}
              onRemoveCollateral={() => {
                if (isConnected) setIsRemoveCollateralModalOpen(true);
              }}
              onBorrow={() => {
                if (isConnected) setIsBorrowModalOpen(true);
              }}
              onRepay={() => {
                if (isConnected) setIsRepayModalOpen(true);
              }}
              onGetLeverage={() => {
                if (selectedMarginAccount != null) {
                  const primeAccountUrl = `${primeUrl()}borrow/account/${selectedMarginAccount.address}`;
                  window.open(primeAccountUrl, '_blank');
                }
              }}
            />
          </MonitorContainer>
          <GraphContainer>
            <div>
              {graphData && graphData.length > 0 ? <BorrowGraph graphData={graphData} /> : <BorrowGraphPlaceholder />}
              <div className='text-center opacity-50 pl-8'>
                <Text size='S' weight='regular' color={LABEL_TEXT_COLOR}>
                  <em>
                    IV comes from an on-chain oracle. It influences the current collateral factor, which impacts the
                    health of your account.
                  </em>
                </Text>
              </div>
            </div>
          </GraphContainer>
          <MetricsContainer>
            <BorrowMetrics
              marginAccount={selectedMarginAccount}
              dailyInterest0={dailyInterest0}
              dailyInterest1={dailyInterest1}
              uniswapPositions={uniswapPositions}
            />
          </MetricsContainer>
          <UniswapPositionsContainer>
            <UniswapPositionList
              marginAccount={selectedMarginAccount}
              uniswapPositions={uniswapPositions}
              withdrawableUniswapNFTs={withdrawableUniswapNFTPositions}
              setPendingTxn={setPendingTxn}
            />
          </UniswapPositionsContainer>
          <StatsContainer>
            <GlobalStatsTable marginAccount={selectedMarginAccount} marketInfo={selectedMarketInfo} />
          </StatsContainer>
          {selectedMarginAccount && (
            <LinkContainer>
              <InfoIcon width={16} height={16} />
              <Text size='S' color={BORROW_TITLE_TEXT_COLOR} className='flex gap-1 whitespace-nowrap'>
                <StyledExternalLink href={selectedMarginAccountEtherscanUrl} target='_blank'>
                  View this account on Etherscan
                </StyledExternalLink>
              </Text>
            </LinkContainer>
          )}
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
            isLoadingUniswapPositions={isLoadingUniswapPositions}
            existingUniswapPositions={uniswapPositions}
            uniswapNFTPositions={filteredNonZeroUniswapNFTPositions}
            isOpen={isAddCollateralModalOpen}
            setIsOpen={setIsAddCollateralModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <RemoveCollateralModal
            marginAccount={selectedMarginAccount}
            uniswapPositions={uniswapPositions}
            marketInfo={selectedMarketInfo}
            isOpen={isRemoveCollateralModalOpen}
            setIsOpen={setIsRemoveCollateralModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <BorrowModal
            marginAccount={selectedMarginAccount}
            uniswapPositions={uniswapPositions}
            marketInfo={selectedMarketInfo}
            isOpen={isBorrowModalOpen}
            setIsOpen={setIsBorrowModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <RepayModal
            marginAccount={selectedMarginAccount}
            uniswapPositions={uniswapPositions}
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
