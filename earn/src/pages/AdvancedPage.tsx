import { useEffect, useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import JSBI from 'jsbi';
import { useSearchParams } from 'react-router-dom';
import Banner from 'shared/lib/components/banner/Banner';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { RESPONSIVE_BREAKPOINT_SM } from 'shared/lib/data/constants/Breakpoints';
import { ALOE_II_BORROWER_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GetNumericFeeTier } from 'shared/lib/data/FeeTier';
import { Token } from 'shared/lib/data/Token';
import { fetchUniswapNFTPositions, UniswapNFTPosition } from 'shared/lib/data/Uniswap';
import { useBorrowerNfts } from 'shared/lib/hooks/UseBorrowerNft';
import useChain from 'shared/lib/hooks/UseChain';
import { useLendingPair, useLendingPairs } from 'shared/lib/hooks/UseLendingPairs';
import { useTokenColors } from 'shared/lib/hooks/UseTokenColors';
import { useUniswapPools } from 'shared/lib/hooks/UseUniswapPools';
import { getBlockExplorerUrl } from 'shared/lib/util/Chains';
import styled from 'styled-components';
import { linea } from 'viem/chains';
import { Config, useAccount, useBlockNumber, useClient, usePublicClient } from 'wagmi';

import { ReactComponent as InfoIcon } from '../assets/svg/info.svg';
import { BorrowMetrics } from '../components/advanced/BorrowMetrics';
import GlobalStatsTable from '../components/advanced/GlobalStatsTable';
import ManageAccountButtons from '../components/advanced/ManageAccountButtons';
import AddCollateralModal from '../components/advanced/modal/AddCollateralModal';
import BorrowModal from '../components/advanced/modal/BorrowModal';
import ClearWarningModal from '../components/advanced/modal/ClearWarningModal';
import NewSmartWalletModal from '../components/advanced/modal/NewSmartWalletModal';
import RemoveCollateralModal from '../components/advanced/modal/RemoveCollateralModal';
import RepayModal from '../components/advanced/modal/RepayModal';
import WithdrawAnteModal from '../components/advanced/modal/WithdrawAnteModal';
import SmartWalletButton, { NewSmartWalletButton } from '../components/advanced/SmartWalletButton';
import { TokenAllocationWidget } from '../components/advanced/TokenAllocationWidget';
import { UniswapPositionList } from '../components/advanced/UniswapPositionList';
import PendingTxnModal, { PendingTxnModalStatus } from '../components/common/PendingTxnModal';
import { useDeprecatedMarginAccountShim } from '../hooks/useDeprecatedMarginAccountShim';
import { useEthersProvider } from '../util/Provider';

const BORROW_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const SELECTED_BORROWER_NFT_ID = 'nft';

const Container = styled.div`
  display: grid;
  gap: 20px;
  max-width: 1280px;
  margin: 0 auto;
  margin-top: 24px;

  grid-template-columns: 1fr 6fr;
  grid-template-rows: auto auto;
  grid-template-areas:
    'title buttons'
    'list data';

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto auto;
    grid-template-areas:
      'title'
      'list'
      'buttons'
      'data';
  }
`;

const GridAreaForButtons = styled.div`
  display: flex;
  grid-area: buttons;

  background: rgba(13, 23, 30, 1);

  padding: 16px;
  border-radius: 16px;
`;

const GridAreaForNFTList = styled.div`
  display: flex;
  flex-direction: column;
  grid-area: list;

  gap: 4px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    flex-direction: row;
    width: 100%;
    overflow-x: scroll;
  }
`;

const GridAreaForData = styled.div`
  display: flex;
  flex-direction: column;
  grid-area: data;

  background: rgba(13, 23, 30, 1);

  gap: 64px;
  padding: 16px;
  border-radius: 16px;
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

const LinkContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
`;

enum OpenedModal {
  NONE,
  NEW_SMART_WALLET,
  ADD_COLLATERAL,
  REMOVE_COLLATERAL,
  BORROW,
  REPAY,
  WITHDRAW_ANTE,
  PENDING_TXN,
  CLEAR_WARNING,
}

export type UniswapPoolInfo = {
  token0: Token;
  token1: Token;
  fee: number;
};

export default function AdvancedPage() {
  const activeChain = useChain();
  const client = useClient<Config>({ chainId: activeChain.id });
  const provider = useEthersProvider(client);
  const { address: userAddress, isConnected } = useAccount();

  const [uniswapNFTPositions, setUniswapNFTPositions] = useState<Map<number, UniswapNFTPosition>>(new Map());
  const [openedModal, setOpenedModal] = useState(OpenedModal.NONE);
  const [pendingTxn, setPendingTxn] = useState<WriteContractReturnType | null>(null);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const { lendingPairs, refetchOracleData, refetchLenderData } = useLendingPairs(activeChain.id);
  const { data: tokenColors } = useTokenColors(lendingPairs);
  const availablePools = useUniswapPools(lendingPairs);
  const { borrowerNfts, refetchBorrowerNftRefs, refetchBorrowers } = useBorrowerNfts(
    availablePools,
    userAddress,
    activeChain.id
  );
  const borrowerNftsDeprecated = useDeprecatedMarginAccountShim(lendingPairs, borrowerNfts);

  // Poll for `blockNumber` when app is in the foreground. Not much different than a `useInterval` that stops
  // when in the background
  const { data: blockNumber } = useBlockNumber({
    chainId: activeChain.id,
    cacheTime: 5_000,
    watch: false,
    query: {
      refetchOnMount: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 5_000,
      refetchIntervalInBackground: false,
    },
  });
  // Use the `blockNumber` to trigger refresh of certain data
  useEffect(() => {
    if (activeChain.id === linea.id || !blockNumber) return;
    // NOTE: Due to polling, we don't receive every block, so this bisection isn't perfect. Close enough though.
    if (blockNumber % 2n) {
      refetchOracleData();
    } else {
      refetchBorrowers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockNumber]);

  const selection = useMemo(() => {
    if (!borrowerNftsDeprecated || borrowerNftsDeprecated.length === 0) return undefined;

    const nftId = searchParams.get(SELECTED_BORROWER_NFT_ID);
    let idx = borrowerNftsDeprecated.findIndex((ref) => parseInt(ref.tokenId.slice(-4), 16).toString() === nftId);
    if (idx === -1) idx = 0;

    return borrowerNftsDeprecated[idx];
  }, [searchParams, borrowerNftsDeprecated]);

  const market = useLendingPair(lendingPairs, selection?.uniswapPool);

  useEffect(() => {
    (async () => {
      if (userAddress === undefined || provider === undefined) return;
      const fetchedUniswapNFTPositions = await fetchUniswapNFTPositions(userAddress, provider);
      setUniswapNFTPositions(fetchedUniswapNFTPositions);
    })();
  }, [userAddress, provider, setUniswapNFTPositions]);

  const publicClient = usePublicClient({ chainId: activeChain.id });
  useEffect(() => {
    (async () => {
      if (!pendingTxn || !publicClient) return;
      setPendingTxnModalStatus(PendingTxnModalStatus.PENDING);
      setOpenedModal(OpenedModal.PENDING_TXN);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: pendingTxn,
      });
      if (receipt.status === 'success') {
        setPendingTxnModalStatus(PendingTxnModalStatus.SUCCESS);
      } else {
        setPendingTxnModalStatus(PendingTxnModalStatus.FAILURE);
      }
    })();
  }, [publicClient, pendingTxn, setOpenedModal, setPendingTxnModalStatus]);

  const filteredNonZeroUniswapNFTPositions = useMemo(() => {
    const filteredPositions: Map<number, UniswapNFTPosition> = new Map();
    if (!selection) return filteredPositions;

    uniswapNFTPositions.forEach((position, tokenId) => {
      if (
        position.token0.equals(selection.token0) &&
        position.token1.equals(selection.token1) &&
        position.fee === GetNumericFeeTier(selection.feeTier) &&
        JSBI.greaterThan(position.liquidity, JSBI.BigInt('0'))
      ) {
        filteredPositions.set(tokenId, position);
      }
    });
    return filteredPositions;
  }, [selection, uniswapNFTPositions]);

  const withdrawableUniswapNFTPositions = useMemo(() => {
    const filteredPositions: Map<number, UniswapNFTPosition> = new Map();
    if (!selection) return filteredPositions;

    selection.assets.uniswapPositions.forEach((uniswapPosition) => {
      const isNonZero = JSBI.greaterThan(uniswapPosition.liquidity, JSBI.BigInt('0'));
      const matchingNFTPosition = Array.from(uniswapNFTPositions.entries()).find(([, position]) => {
        return position.lower === uniswapPosition.lower && position.upper === uniswapPosition.upper;
      });
      if (matchingNFTPosition !== undefined && isNonZero) {
        filteredPositions.set(matchingNFTPosition[0], matchingNFTPosition[1]);
      }
    });
    return filteredPositions;
  }, [selection, uniswapNFTPositions]);

  const blockExplorerUrl = getBlockExplorerUrl(activeChain);
  const selectionUrlBlockExplorer = `${blockExplorerUrl}/address/${selection?.address}`;
  const selectionUrlOpensea = `https://opensea.io/assets/${activeChain.name}/${
    ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id]
  }/${selection ? BigInt(selection.tokenId).toString(10) : ''}`;

  const selectionHasEther = selection?.ethBalance!.isGtZero() ?? false;
  const selectionHasLiabilities = Boolean(
    (selection?.liabilities.amount0 ?? 0) > 0 || (selection?.liabilities.amount1 ?? 0) > 0
  );

  const userHasBorrowers = borrowerNfts.length > 0;
  const canWithdrawAnte = selectionHasEther && !selectionHasLiabilities;
  const canClearWarning = selection && selection.health >= 1 && selection.warningTime > 0;

  return (
    <>
      <Banner
        bannerName='Note'
        bannerText={`Due to UI limitations, once you transact with a Borrower NFT on this page, 
        it may not load properly on the Markets page.`}
        bannerColor='#8884d8'
      />
      <AppPage>
        <Container>
          <div className='self-end'>
            <Text size='M' weight='bold' color={BORROW_TITLE_TEXT_COLOR}>
              Borrower NFTs
            </Text>
          </div>
          <GridAreaForButtons>
            <ManageAccountButtons
              onAddCollateral={() => setOpenedModal(OpenedModal.ADD_COLLATERAL)}
              onRemoveCollateral={() => setOpenedModal(OpenedModal.REMOVE_COLLATERAL)}
              onBorrow={() => setOpenedModal(OpenedModal.BORROW)}
              onRepay={() => setOpenedModal(OpenedModal.REPAY)}
              onWithdrawAnte={canWithdrawAnte ? () => setOpenedModal(OpenedModal.WITHDRAW_ANTE) : undefined}
              onClearWarning={canClearWarning ? () => setOpenedModal(OpenedModal.CLEAR_WARNING) : undefined}
              isDisabled={!selection || !isConnected}
            />
          </GridAreaForButtons>
          <GridAreaForNFTList>
            {borrowerNftsDeprecated?.map((nft, i) => {
              const tokenCounter = parseInt(nft.tokenId.slice(-4), 16);
              return (
                <SmartWalletButton
                  token0={nft.token0}
                  token1={nft.token1}
                  tokenId={tokenCounter}
                  isActive={selection?.address === nft.address}
                  onClick={() => {
                    setSearchParams({ [SELECTED_BORROWER_NFT_ID]: tokenCounter.toString() });
                  }}
                  key={nft.address}
                />
              );
            })}
            <NewSmartWalletButton
              userHasNoMarginAccounts={!userHasBorrowers}
              onClick={() => setOpenedModal(OpenedModal.NEW_SMART_WALLET)}
            />
          </GridAreaForNFTList>
          <GridAreaForData>
            <BorrowMetrics
              market={market}
              borrowerNft={selection}
              userHasNoMarginAccounts={!userHasBorrowers}
            />
            <UniswapPositionList
              borrower={selection}
              importableUniswapNFTPositions={filteredNonZeroUniswapNFTPositions}
              withdrawableUniswapNFTs={withdrawableUniswapNFTPositions}
              setPendingTxn={setPendingTxn}
            />
            <TokenAllocationWidget borrower={selection} tokenColors={tokenColors!} />
            <GlobalStatsTable market={market} />
            {selection && (
              <div className='flex flex-col gap-4 mb-8'>
                <LinkContainer>
                  <InfoIcon width={16} height={16} />
                  <Text size='S' color={BORROW_TITLE_TEXT_COLOR} className='flex gap-1 whitespace-nowrap'>
                    <StyledExternalLink href={selectionUrlBlockExplorer} target='_blank'>
                      View on Etherscan
                    </StyledExternalLink>
                  </Text>
                </LinkContainer>
                <LinkContainer>
                  <InfoIcon width={16} height={16} />
                  <Text size='S' color={BORROW_TITLE_TEXT_COLOR} className='flex gap-1 whitespace-nowrap'>
                    <StyledExternalLink href={selectionUrlOpensea} target='_blank'>
                      View on OpenSea
                    </StyledExternalLink>
                  </Text>
                </LinkContainer>
              </div>
            )}
          </GridAreaForData>
        </Container>
        {availablePools.size > 0 && (
          <NewSmartWalletModal
            availablePools={availablePools}
            defaultPool={availablePools.keys().next().value}
            isOpen={openedModal === OpenedModal.NEW_SMART_WALLET}
            setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.NEW_SMART_WALLET : OpenedModal.NONE)}
            setPendingTxn={setPendingTxn}
          />
        )}
        {selection && market && (
          <>
            <AddCollateralModal
              borrower={selection}
              uniswapNFTPositions={filteredNonZeroUniswapNFTPositions}
              isOpen={openedModal === OpenedModal.ADD_COLLATERAL}
              setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.ADD_COLLATERAL : OpenedModal.NONE)}
              setPendingTxn={setPendingTxn}
            />
            <RemoveCollateralModal
              borrower={selection}
              isOpen={openedModal === OpenedModal.REMOVE_COLLATERAL}
              setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.REMOVE_COLLATERAL : OpenedModal.NONE)}
              setPendingTxn={setPendingTxn}
            />
            <BorrowModal
              borrower={selection}
              market={market}
              isOpen={openedModal === OpenedModal.BORROW}
              setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.BORROW : OpenedModal.NONE)}
              setPendingTxn={setPendingTxn}
            />
            <RepayModal
              borrower={selection}
              isOpen={openedModal === OpenedModal.REPAY}
              setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.REPAY : OpenedModal.NONE)}
              setPendingTxn={setPendingTxn}
            />
            <WithdrawAnteModal
              borrower={selection}
              isOpen={openedModal === OpenedModal.WITHDRAW_ANTE}
              setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.WITHDRAW_ANTE : OpenedModal.NONE)}
              setPendingTxn={setPendingTxn}
            />
            <ClearWarningModal
              borrower={selection}
              market={market}
              isOpen={openedModal === OpenedModal.CLEAR_WARNING}
              setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.CLEAR_WARNING : OpenedModal.NONE)}
              setPendingTxn={setPendingTxn}
            />
          </>
        )}
        <PendingTxnModal
          isOpen={openedModal === OpenedModal.PENDING_TXN}
          setIsOpen={(isOpen: boolean) => {
            setOpenedModal(isOpen ? OpenedModal.PENDING_TXN : OpenedModal.NONE);
            if (!isOpen) {
              setPendingTxn(null);
            }
          }}
          txnHash={pendingTxn}
          onConfirm={() => {
            setOpenedModal(OpenedModal.NONE);
            refetchLenderData();
            refetchBorrowerNftRefs().then(() => refetchBorrowers());
          }}
          status={pendingTxnModalStatus}
        />
      </AppPage>
    </>
  );
}
