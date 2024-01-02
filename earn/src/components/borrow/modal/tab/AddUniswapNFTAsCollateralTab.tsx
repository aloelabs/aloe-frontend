import { useContext, useEffect, useState, useMemo } from 'react';

import { erc721ABI, SendTransactionResult } from '@wagmi/core';
import { BigNumber, ethers } from 'ethers';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Pagination from 'shared/lib/components/common/Pagination';
import { Display, Text } from 'shared/lib/components/common/Typography';
import {
  UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
  ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS,
  ALOE_II_BORROWER_NFT_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { truncateDecimals } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { Address, useAccount, useContractRead, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import { sqrtRatioToTick } from '../../../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../../../data/BorrowerNft';
import { getValueOfLiquidity, tickToPrice, UniswapNFTPosition, UniswapPosition, zip } from '../../../../data/Uniswap';
import TokenPairIcons from '../../../common/TokenPairIcons';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';
const ITEMS_PER_PAGE = 2;

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room

const UniswapNFTPositionsPage = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 280px;
`;

type UniswapNFTPositionEntry = [number, UniswapNFTPosition];

enum ConfirmButtonState {
  APPROVE_NFT_MANAGER,
  APPROVING,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(state: ConfirmButtonState): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.APPROVE_NFT_MANAGER:
      return { text: 'Approve', enabled: true };
    case ConfirmButtonState.APPROVING:
      return { text: 'Approving', enabled: false };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    default:
      return { text: 'Confirm', enabled: false };
  }
}

export const UniswapNFTPositionButtonWrapper = styled.button.attrs((props: { active: boolean }) => props)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 8px 16px;
  gap: 8px;
  border-radius: 8px;
  opacity: ${(props) => (props.active ? 1 : 0.25)};
  filter: ${(props) => (props.active ? 'none' : 'grayscale(100%)')};
  cursor: pointer;
  background-color: ${GREY_700};

  &:hover {
    filter: none;
    opacity: 1;
  }
`;

type UniswapNFTPositionButtonProps = {
  borrower: BorrowerNftBorrower;
  uniswapNFTPosition: UniswapNFTPosition;
  isActive: boolean;
  onClick: () => void;
};

function UniswapNFTPositionButton(props: UniswapNFTPositionButtonProps) {
  const { borrower, uniswapNFTPosition, isActive, onClick } = props;

  const { token0, token1 } = uniswapNFTPosition;

  const minPrice = tickToPrice(
    uniswapNFTPosition.lower,
    uniswapNFTPosition.token0.decimals,
    uniswapNFTPosition.token1.decimals,
    true
  );

  const maxPrice = tickToPrice(
    uniswapNFTPosition.upper,
    uniswapNFTPosition.token0.decimals,
    uniswapNFTPosition.token1.decimals,
    true
  );

  const liquidityAmount = getValueOfLiquidity(
    {
      lower: uniswapNFTPosition.lower,
      upper: uniswapNFTPosition.upper,
      liquidity: uniswapNFTPosition.liquidity,
    },
    sqrtRatioToTick(borrower.sqrtPriceX96),
    uniswapNFTPosition.token1.decimals
  );

  return (
    <UniswapNFTPositionButtonWrapper onClick={onClick} active={isActive}>
      <div className='flex items-center gap-4'>
        <TokenPairIcons
          token0IconPath={token0.logoURI}
          token1IconPath={token1.logoURI}
          token0AltText={`${token0.name}'s Icon`}
          token1AltText={`${token1.name}'s Icon`}
        />
        <Display size='S' weight='semibold'>
          {token0.symbol} / {token1.symbol}
        </Display>
      </div>
      <div className='flex flex-col items-start gap-1'>
        <Text size='M' weight='medium' color={SECONDARY_COLOR}>
          Total Liquidity:
        </Text>
        <Display size='S' weight='semibold'>
          {truncateDecimals(liquidityAmount.toString(), 6)} {token1.symbol}
        </Display>
      </div>
      <div className='flex items-center gap-4'>
        <Text size='S' color={SECONDARY_COLOR}>
          Min: {truncateDecimals(minPrice.toString(), 3)} {token1.symbol} per {token0.symbol} - Max:{' '}
          {truncateDecimals(maxPrice.toString(), 3)} {token1.symbol} per {token0.symbol}
        </Text>
      </div>
    </UniswapNFTPositionButtonWrapper>
  );
}

type AddUniswapNFTAsCollateralButtonProps = {
  borrower: BorrowerNftBorrower;
  existingUniswapPositions: readonly UniswapPosition[];
  uniswapNFTPosition: UniswapNFTPositionEntry;
  userAddress: Address;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: SendTransactionResult | null) => void;
};

function AddUniswapNFTAsCollateralButton(props: AddUniswapNFTAsCollateralButtonProps) {
  const { borrower, existingUniswapPositions, uniswapNFTPosition, userAddress, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);

  const [isPending, setIsPending] = useState(false);
  const [approvingTxn, setApprovingTxn] = useState<SendTransactionResult | null>(null);

  // MARK: Read/write hooks for Router's allowance --------------------------------------------------------------------
  const { refetch: refetchGetApprovedData, data: getApprovedData } = useContractRead({
    address: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[activeChain.id],
    abi: erc721ABI,
    functionName: 'getApproved',
    args: [BigNumber.from(uniswapNFTPosition[0].toFixed(0))] as const,
    chainId: activeChain.id,
  });
  const { writeAsync: writeApproveAsync } = useContractWrite({
    address: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[activeChain.id],
    abi: erc721ABI,
    functionName: 'approve',
    mode: 'recklesslyUnprepared',
    chainId: activeChain.id,
  });

  const encodedData = useMemo(() => {
    return ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'int24', 'int24', 'int128', 'uint144'],
      [
        uniswapNFTPosition[0],
        uniswapNFTPosition[1].lower,
        uniswapNFTPosition[1].upper,
        `-${uniswapNFTPosition[1].liquidity.toString(10)}`,
        zip([
          ...existingUniswapPositions,
          {
            lower: uniswapNFTPosition[1].lower,
            upper: uniswapNFTPosition[1].upper,
            liquidity: uniswapNFTPosition[1].liquidity,
          },
        ]),
      ]
    ) as `0x${string}`;
  }, [uniswapNFTPosition, existingUniswapPositions]);

  const { config: contractWriteConfig } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      userAddress,
      [borrower.index],
      [ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS[activeChain.id]],
      [encodedData as `0x${string}`],
      [0],
    ],
    enabled: getApprovedData === ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS[activeChain.id],
    chainId: activeChain.id,
  });
  if (contractWriteConfig.request) {
    contractWriteConfig.request.gasLimit = contractWriteConfig.request.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100);
  }
  const {
    write: contractWrite,
    data: contractData,
    isSuccess: contractDidSucceed,
    isLoading: contractIsLoading,
  } = useContractWrite(contractWriteConfig);

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
      setIsOpen(false);
    } else if (!contractIsLoading && !contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractIsLoading, setPendingTxn, setIsOpen]);

  let confirmButtonState = ConfirmButtonState.READY;

  if (approvingTxn !== null) {
    confirmButtonState = ConfirmButtonState.APPROVING;
  } else if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (getApprovedData !== ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS[activeChain.id]) {
    confirmButtonState = ConfirmButtonState.APPROVE_NFT_MANAGER;
  } else if (contractWriteConfig && contractWriteConfig.request === undefined) {
    confirmButtonState = ConfirmButtonState.LOADING;
  }

  const confirmButton = getConfirmButton(confirmButtonState);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      disabled={!confirmButton.enabled}
      onClick={() => {
        if (confirmButtonState === ConfirmButtonState.APPROVE_NFT_MANAGER) {
          setIsPending(true);
          writeApproveAsync?.({
            recklesslySetUnpreparedArgs: [
              ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS[activeChain.id],
              BigNumber.from(uniswapNFTPosition[0].toFixed(0)),
            ],
            recklesslySetUnpreparedOverrides: { gasLimit: BigNumber.from(100000) },
          })
            .then((txnResult) => {
              setApprovingTxn(txnResult);
              txnResult
                .wait(1)
                .then(() => refetchGetApprovedData())
                .finally(() => {
                  setApprovingTxn(null);
                  setIsPending(false);
                });
            })
            .catch((_err) => {
              setApprovingTxn(null);
              setIsPending(false);
            });
        } else if (confirmButtonState === ConfirmButtonState.READY) {
          setIsPending(true);
          contractWrite?.();
        }
      }}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type AddUniswapNFTAsCollateralTabProps = {
  borrower: BorrowerNftBorrower;
  existingUniswapPositions: readonly UniswapPosition[];
  uniswapNFTPositions: Map<number, UniswapNFTPosition>;
  defaultUniswapNFTPosition: [number, UniswapNFTPosition];
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export function AddUniswapNFTAsCollateralTab(props: AddUniswapNFTAsCollateralTabProps) {
  const {
    borrower,
    existingUniswapPositions,
    uniswapNFTPositions,
    defaultUniswapNFTPosition,
    setIsOpen,
    setPendingTxn,
  } = props;
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTokenId, setSelectedTokenId] = useState<number>(defaultUniswapNFTPosition[0]);

  const { address: userAddress } = useAccount();

  const filteredPages: UniswapNFTPositionEntry[][] = useMemo(() => {
    const pages: UniswapNFTPositionEntry[][] = [];
    let page: UniswapNFTPositionEntry[] = [];
    Array.from(uniswapNFTPositions.entries()).forEach((pair, i) => {
      if (i % ITEMS_PER_PAGE === 0 && i !== 0) {
        pages.push(page);
        page = [];
      }
      page.push(pair);
    });
    pages.push(page);
    return pages;
  }, [uniswapNFTPositions]);

  // If the current page is greater than the number of pages, reset the current page to 1
  // We also want to return null here so that the rest of the modal doesn't render until the current page is reset
  if (currentPage > filteredPages.length) {
    setCurrentPage(1);
    return null;
  }

  if (!userAddress) {
    return null;
  }

  return (
    <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
      <div className='flex flex-col gap-1 w-full'>
        <Text size='M' weight='bold'>
          Uniswap NFT Positions
        </Text>
        <div className='flex flex-col gap-4'>
          <UniswapNFTPositionsPage>
            {filteredPages[currentPage - 1].map(([tokenId, position]) => (
              <UniswapNFTPositionButton
                key={tokenId}
                borrower={borrower}
                uniswapNFTPosition={position}
                isActive={tokenId === selectedTokenId}
                onClick={() => setSelectedTokenId(tokenId)}
              />
            ))}
            {filteredPages[currentPage - 1].length === 0 && (
              <Text size='M' className='text-center'>
                No Uniswap NFT Positions found
              </Text>
            )}
          </UniswapNFTPositionsPage>
          <Pagination
            itemsPerPage={ITEMS_PER_PAGE}
            currentPage={currentPage}
            loading={false}
            totalItems={uniswapNFTPositions.size}
            onPageChange={(newPage: number) => {
              setCurrentPage(newPage);
            }}
            hidePageRange={true}
          />
        </div>
      </div>
      <div className='w-full'>
        <AddUniswapNFTAsCollateralButton
          borrower={borrower}
          existingUniswapPositions={existingUniswapPositions}
          uniswapNFTPosition={[selectedTokenId, uniswapNFTPositions.get(selectedTokenId)!]}
          userAddress={userAddress}
          setIsOpen={setIsOpen}
          setPendingTxn={setPendingTxn}
        />
        <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
          By using our service, you agree to our{' '}
          <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
            Terms of Service
          </a>{' '}
          and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
          your duty to educate yourself and be aware of the risks.
        </Text>
      </div>
    </div>
  );
}
