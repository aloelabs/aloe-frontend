import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { SquareInputWithIcon } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import Pagination from 'shared/lib/components/common/Pagination';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { useAccount, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import FactoryABI from '../../../assets/abis/Factory.json';
import { ReactComponent as SearchIcon } from '../../../assets/svg/search.svg';
import { ALOE_II_FACTORY_ADDRESS } from '../../../data/constants/Addresses';
import { UniswapPoolInfo } from '../../../data/MarginAccount';
import SmartWalletButton from '../SmartWalletButton';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room
const ITEMS_PER_PAGE = 5;

const SmartWalletOptionsPage = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  // The height of 5 buttons + gap between them
  min-height: 304px;
`;

type CreateSmartWalletButtonProps = {
  poolAddress: string;
  uniswapPoolInfo: UniswapPoolInfo;
  userAddress: string;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function CreateSmartWalletButton(props: CreateSmartWalletButtonProps) {
  const { poolAddress, uniswapPoolInfo, userAddress, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);

  const [isPending, setIsPending] = useState(false);

  const { config: createBorrowerConfig } = usePrepareContractWrite({
    address: ALOE_II_FACTORY_ADDRESS,
    abi: FactoryABI,
    functionName: 'createBorrower',
    args: [poolAddress, userAddress],
    enabled: !!poolAddress && !!userAddress,
    chainId: activeChain.id,
  });
  const createBorrowerUpdatedRequest = useMemo(() => {
    if (createBorrowerConfig.request) {
      return {
        ...createBorrowerConfig.request,
        gasLimit: createBorrowerConfig.request.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100),
      };
    }
    return undefined;
  }, [createBorrowerConfig.request]);
  const {
    write: createBorrower,
    isSuccess: successfullyCreatedBorrower,
    isLoading: isLoadingCreateBorrower,
    data: createBorrowerData,
  } = useContractWrite({
    ...createBorrowerConfig,
    request: createBorrowerUpdatedRequest,
  });

  useEffect(() => {
    if (successfullyCreatedBorrower && createBorrowerData) {
      setPendingTxn(createBorrowerData);
      setIsOpen(false);
    } else if (!isLoadingCreateBorrower && !successfullyCreatedBorrower) {
      setIsPending(false);
    }
  }, [createBorrowerData, isLoadingCreateBorrower, setIsOpen, setPendingTxn, successfullyCreatedBorrower]);

  const pairLabel = `${uniswapPoolInfo.token0.ticker}/${uniswapPoolInfo.token1.ticker}`;

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      onClick={() => {
        setIsPending(true);
        createBorrower?.();
      }}
      disabled={isPending || poolAddress === ''}
    >
      Create {pairLabel} Smart Wallet
    </FilledStylizedButton>
  );
}

export type NewSmartWalletModalProps = {
  availablePools: Map<string, UniswapPoolInfo>;
  defaultPool: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function NewSmartWalletModal(props: NewSmartWalletModalProps) {
  const { availablePools, defaultPool, isOpen, setIsOpen, setPendingTxn } = props;

  const [selectedPool, setSelectedPool] = useState<string>(defaultPool);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterInput, setFilterInput] = useState('');

  const { address: userAddress } = useAccount();

  const resetModal = () => {
    setSelectedPool(defaultPool);
    setCurrentPage(1);
    setFilterInput('');
  };

  const filteredAvailablePools = useMemo(() => {
    const filteredPools = new Map<string, UniswapPoolInfo>();
    Array.from(availablePools.entries()).forEach(([poolAddress, poolInfo]) => {
      if (
        poolInfo.token0.ticker.toLowerCase().includes(filterInput.toLowerCase()) ||
        poolInfo.token1.ticker.toLowerCase().includes(filterInput.toLowerCase()) ||
        poolAddress.toLowerCase().includes(filterInput.toLowerCase())
      ) {
        filteredPools.set(poolAddress, poolInfo);
      }
    });
    return filteredPools;
  }, [availablePools, filterInput]);

  const filteredPages: [string, UniswapPoolInfo][][] = useMemo(() => {
    const pages: [string, UniswapPoolInfo][][] = [];
    let page: [string, UniswapPoolInfo][] = [];
    Array.from(filteredAvailablePools.entries()).forEach((pair, i) => {
      if (i % ITEMS_PER_PAGE === 0 && i !== 0) {
        pages.push(page);
        page = [];
      }
      page.push(pair);
    });
    pages.push(page);
    return pages;
  }, [filteredAvailablePools]);

  // If the current page is greater than the number of pages, reset the current page to 1
  // We also want to return null here so that the rest of the modal doesn't render until the current page is reset
  if (currentPage > filteredPages.length) {
    setCurrentPage(1);
    return null;
  }

  if (!userAddress || !isOpen) {
    return null;
  }

  const selectedPoolInfo = availablePools.get(selectedPool);

  return (
    <Modal
      isOpen={isOpen}
      title='Create a new smart wallet'
      setIsOpen={(open: boolean) => {
        setIsOpen(open);
        if (!open) {
          resetModal();
        }
      }}
      maxHeight='750px'
    >
      <div className='w-full'>
        <div className='flex flex-col gap-4 mb-8'>
          <Text size='M' weight='medium'>
            Select a pair to borrow from
          </Text>
          <SquareInputWithIcon
            Icon={<SearchIcon />}
            placeholder='Search for a pair or token'
            size='M'
            onChange={(e) => {
              setFilterInput(e.target.value);
            }}
            svgColorType='stroke'
            value={filterInput}
            leadingIcon={true}
            fullWidth={true}
          />
          <SmartWalletOptionsPage>
            {filteredPages[currentPage - 1].map((poolOption: [string, UniswapPoolInfo]) => {
              return (
                <SmartWalletButton
                  isActive={selectedPool === poolOption[0]}
                  token0={poolOption[1].token0}
                  token1={poolOption[1].token1}
                  onClick={() => {
                    setSelectedPool(poolOption[0]);
                  }}
                  key={poolOption[0]}
                />
              );
            })}
            {filteredPages[currentPage - 1].length === 0 && (
              <Text size='M' className='text-center'>
                No matching pairs found.
              </Text>
            )}
          </SmartWalletOptionsPage>
          <Pagination
            itemsPerPage={ITEMS_PER_PAGE}
            currentPage={currentPage}
            loading={false}
            totalItems={filteredAvailablePools.size}
            onPageChange={(newPage: number) => {
              setCurrentPage(newPage);
            }}
            hidePageRange={true}
          />
        </div>
        {selectedPoolInfo && (
          <CreateSmartWalletButton
            poolAddress={selectedPool || ''}
            uniswapPoolInfo={selectedPoolInfo}
            userAddress={userAddress}
            setIsOpen={setIsOpen}
            setPendingTxn={setPendingTxn}
          />
        )}
      </div>
    </Modal>
  );
}
