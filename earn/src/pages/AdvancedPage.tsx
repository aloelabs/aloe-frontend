import { useEffect, useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Banner from 'shared/lib/components/banner/Banner';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BORROWER_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GetNumericFeeTier } from 'shared/lib/data/FeeTier';
import { GN } from 'shared/lib/data/GoodNumber';
import useChain from 'shared/lib/data/hooks/UseChain';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { useLendingPair, useLendingPairs } from 'shared/lib/data/hooks/UseLendingPairs';
import { Token } from 'shared/lib/data/Token';
import { fetchUniswapNFTPositions, UniswapNFTPosition } from 'shared/lib/data/Uniswap';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';
import styled from 'styled-components';
import { Address } from 'viem';
import { Config, useAccount, useBalance, useClient, usePublicClient } from 'wagmi';

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
import { BorrowerNftBorrower, fetchListOfBorrowerNfts } from '../data/BorrowerNft';
import { RESPONSIVE_BREAKPOINT_SM } from '../data/constants/Breakpoints';
import useAvailablePools from '../data/hooks/UseAvailablePools';
import { fetchBorrowerDatas } from '../data/MarginAccount';
import { getProminentColor } from '../util/Colors';
import { useEthersProvider } from '../util/Provider';

const BORROW_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const SELECTED_MARGIN_ACCOUNT_KEY = 'account';

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

  const [borrowerNftBorrowers, setBorrowerNftBorrowers] = useChainDependentState<BorrowerNftBorrower[] | null>(
    null,
    activeChain.id
  );
  const [uniswapNFTPositions, setUniswapNFTPositions] = useState<Map<number, UniswapNFTPosition>>(new Map());
  const [openedModal, setOpenedModal] = useState(OpenedModal.NONE);
  const [pendingTxn, setPendingTxn] = useState<WriteContractReturnType | null>(null);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);
  const [tokenColors, setTokenColors] = useChainDependentState<Map<Address, string>>(new Map(), activeChain.id);

  const [searchParams, setSearchParams] = useSearchParams();

  const navigate = useNavigate();

  const selectedMarginAccount = useMemo(() => {
    const marginAccountSearchParam = searchParams.get(SELECTED_MARGIN_ACCOUNT_KEY);
    if (!marginAccountSearchParam) return borrowerNftBorrowers?.[0];
    return (
      borrowerNftBorrowers?.find((account) => account.address === marginAccountSearchParam) ?? borrowerNftBorrowers?.[0]
    );
  }, [borrowerNftBorrowers, searchParams]);

  const { lendingPairs } = useLendingPairs(activeChain.id);
  const market = useLendingPair(
    lendingPairs,
    selectedMarginAccount?.token0.address,
    selectedMarginAccount?.token1.address
  );

  const availablePools = useAvailablePools();

  // MARK: Fetch margin accounts
  useEffect(() => {
    (async () => {
      if (!provider || userAddress === undefined || availablePools.size === 0) return;
      const chainId = (await provider.getNetwork()).chainId;

      const borrowerNfts = await fetchListOfBorrowerNfts(chainId, provider, userAddress);
      const borrowers = await fetchBorrowerDatas(
        chainId,
        provider,
        borrowerNfts.map((x) => x.borrowerAddress),
        availablePools
      );

      const fetchedBorrowerNftBorrowers: BorrowerNftBorrower[] = borrowers.map((borrower, i) => ({
        ...borrower,
        tokenId: borrowerNfts[i].tokenId,
        index: borrowerNfts[i].index,
        mostRecentModify: borrowerNfts[i].mostRecentModify,
      }));
      setBorrowerNftBorrowers(fetchedBorrowerNftBorrowers);
    })();
  }, [userAddress, provider, availablePools, setBorrowerNftBorrowers]);

  const uniqueTokens = useMemo(() => {
    const tokenSet = new Set<Token>();
    borrowerNftBorrowers?.forEach((borrower) => {
      tokenSet.add(borrower.token0);
      tokenSet.add(borrower.token1);
    });
    return Array.from(tokenSet.values());
  }, [borrowerNftBorrowers]);

  // MARK: Computing token colors
  useEffect(() => {
    (async () => {
      // Compute colors for each token logo (local, but still async)
      const colorPromises = uniqueTokens.map((token) => getProminentColor(token.logoURI || ''));
      const colors = await Promise.all(colorPromises);

      // Convert response to the desired Map format
      const addressToColorMap: Map<Address, string> = new Map();
      uniqueTokens.forEach((token, index) => addressToColorMap.set(token.address, colors[index]));
      setTokenColors(addressToColorMap);
    })();
  }, [uniqueTokens, setTokenColors]);

  // MARK: Reset search param if margin account doesn't exist
  useEffect(() => {
    if (
      borrowerNftBorrowers?.length &&
      selectedMarginAccount?.address !== searchParams.get(SELECTED_MARGIN_ACCOUNT_KEY)
    ) {
      searchParams.delete(SELECTED_MARGIN_ACCOUNT_KEY);
      setSearchParams(searchParams);
    }
  }, [borrowerNftBorrowers?.length, searchParams, selectedMarginAccount, setSearchParams]);

  useEffect(() => {
    (async () => {
      if (userAddress === undefined || provider === undefined) return;
      const fetchedUniswapNFTPositions = await fetchUniswapNFTPositions(userAddress, provider);
      setUniswapNFTPositions(fetchedUniswapNFTPositions);
    })();
  }, [provider, setUniswapNFTPositions, userAddress]);

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

  const { data: accountEtherBalanceResult } = useBalance({
    address: selectedMarginAccount?.address as Address,
    chainId: activeChain.id,
    query: { enabled: selectedMarginAccount !== undefined },
  });

  const accountEtherBalance = accountEtherBalanceResult && GN.fromBigInt(accountEtherBalanceResult.value, 18);

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
    selectedMarginAccount.assets.uniswapPositions.forEach((uniswapPosition) => {
      const isNonZero = JSBI.greaterThan(uniswapPosition.liquidity, JSBI.BigInt('0'));
      const matchingNFTPosition = Array.from(uniswapNFTPositions.entries()).find(([, position]) => {
        return position.lower === uniswapPosition.lower && position.upper === uniswapPosition.upper;
      });
      if (matchingNFTPosition !== undefined && isNonZero) {
        filteredPositions.set(matchingNFTPosition[0], matchingNFTPosition[1]);
      }
    });
    return filteredPositions;
  }, [selectedMarginAccount, uniswapNFTPositions]);

  const defaultPool = Array.from(availablePools.keys())[0];

  const dailyInterest0 =
    ((market?.kitty0Info.borrowAPR || 0) / 365) * (selectedMarginAccount?.liabilities.amount0 || 0);
  const dailyInterest1 =
    ((market?.kitty1Info.borrowAPR || 0) / 365) * (selectedMarginAccount?.liabilities.amount1 || 0);

  const baseEtherscanUrl = getEtherscanUrlForChain(activeChain);
  const selectedMarginAccountEtherscanUrl = `${baseEtherscanUrl}/address/${selectedMarginAccount?.address}`;
  const selectedBorrowerOpenseaUrl = `https://opensea.io/assets/${activeChain.name}/${
    ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id]
  }/${selectedMarginAccount ? ethers.BigNumber.from(selectedMarginAccount!.tokenId).toString() : ''}`;

  const hasLiabilities = Object.values(selectedMarginAccount?.liabilities ?? {}).some((liability) => {
    return liability > 0;
  });

  const accountHasEther = accountEtherBalance?.isGtZero() ?? false;

  const userHasNoMarginAccounts = borrowerNftBorrowers?.length === 0;

  const canWithdrawAnte = !hasLiabilities && accountHasEther;
  const canClearWarning =
    selectedMarginAccount && selectedMarginAccount.health >= 1 && selectedMarginAccount.warningTime > 0;

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
              isDisabled={!selectedMarginAccount || !isConnected}
            />
          </GridAreaForButtons>
          <GridAreaForNFTList>
            {borrowerNftBorrowers?.map((account) => (
              <SmartWalletButton
                token0={account.token0}
                token1={account.token1}
                tokenId={parseInt(account.tokenId.slice(-4), 16)}
                isActive={selectedMarginAccount?.address === account.address}
                onClick={() => {
                  // When a new account is selected, we need to update the
                  // selectedMarginAccount, selectedMarketInfo, and uniswapPositions
                  // setSelectedMarginAccount(account);
                  setSearchParams({ [SELECTED_MARGIN_ACCOUNT_KEY]: account.address });
                }}
                key={account.address}
              />
            ))}
            <NewSmartWalletButton
              userHasNoMarginAccounts={userHasNoMarginAccounts}
              onClick={() => setOpenedModal(OpenedModal.NEW_SMART_WALLET)}
            />
          </GridAreaForNFTList>
          <GridAreaForData>
            <BorrowMetrics
              marginAccount={selectedMarginAccount}
              dailyInterest0={dailyInterest0}
              dailyInterest1={dailyInterest1}
              userHasNoMarginAccounts={userHasNoMarginAccounts}
            />
            <UniswapPositionList
              borrower={selectedMarginAccount}
              importableUniswapNFTPositions={filteredNonZeroUniswapNFTPositions}
              withdrawableUniswapNFTs={withdrawableUniswapNFTPositions}
              setPendingTxn={setPendingTxn}
            />
            <TokenAllocationWidget borrower={selectedMarginAccount} tokenColors={tokenColors} />
            <GlobalStatsTable market={market} />
            {selectedMarginAccount && (
              <div className='flex flex-col gap-4 mb-8'>
                <LinkContainer>
                  <InfoIcon width={16} height={16} />
                  <Text size='S' color={BORROW_TITLE_TEXT_COLOR} className='flex gap-1 whitespace-nowrap'>
                    <StyledExternalLink href={selectedMarginAccountEtherscanUrl} target='_blank'>
                      View on Etherscan
                    </StyledExternalLink>
                  </Text>
                </LinkContainer>
                <LinkContainer>
                  <InfoIcon width={16} height={16} />
                  <Text size='S' color={BORROW_TITLE_TEXT_COLOR} className='flex gap-1 whitespace-nowrap'>
                    <StyledExternalLink href={selectedBorrowerOpenseaUrl} target='_blank'>
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
            defaultPool={defaultPool}
            isOpen={openedModal === OpenedModal.NEW_SMART_WALLET}
            setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.NEW_SMART_WALLET : OpenedModal.NONE)}
            setPendingTxn={setPendingTxn}
          />
        )}
        {selectedMarginAccount && market && (
          <>
            <AddCollateralModal
              borrower={selectedMarginAccount}
              uniswapNFTPositions={filteredNonZeroUniswapNFTPositions}
              isOpen={openedModal === OpenedModal.ADD_COLLATERAL}
              setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.ADD_COLLATERAL : OpenedModal.NONE)}
              setPendingTxn={setPendingTxn}
            />
            <RemoveCollateralModal
              borrower={selectedMarginAccount}
              isOpen={openedModal === OpenedModal.REMOVE_COLLATERAL}
              setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.REMOVE_COLLATERAL : OpenedModal.NONE)}
              setPendingTxn={setPendingTxn}
            />
            <BorrowModal
              borrower={selectedMarginAccount}
              market={market}
              accountEtherBalance={accountEtherBalance}
              isOpen={openedModal === OpenedModal.BORROW}
              setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.BORROW : OpenedModal.NONE)}
              setPendingTxn={setPendingTxn}
            />
            <RepayModal
              borrower={selectedMarginAccount}
              isOpen={openedModal === OpenedModal.REPAY}
              setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.REPAY : OpenedModal.NONE)}
              setPendingTxn={setPendingTxn}
            />
            <WithdrawAnteModal
              borrower={selectedMarginAccount}
              accountEthBalance={accountEtherBalance}
              isOpen={openedModal === OpenedModal.WITHDRAW_ANTE}
              setIsOpen={(isOpen) => setOpenedModal(isOpen ? OpenedModal.WITHDRAW_ANTE : OpenedModal.NONE)}
              setPendingTxn={setPendingTxn}
            />
            <ClearWarningModal
              borrower={selectedMarginAccount}
              market={market}
              accountEtherBalance={accountEtherBalance}
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
            setTimeout(() => {
              navigate(0);
            }, 100);
          }}
          status={pendingTxnModalStatus}
        />
      </AppPage>
    </>
  );
}
