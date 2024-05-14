import { useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { SquareInputWithIcon } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import Pagination from 'shared/lib/components/common/Pagination';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BORROWER_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import useChain from 'shared/lib/data/hooks/UseChain';
import { generateBytes12Salt } from 'shared/lib/util/Salt';
import styled from 'styled-components';
import { Address } from 'viem';
import { useAccount, useSimulateContract, useWriteContract } from 'wagmi';

import { ReactComponent as SearchIcon } from '../../../assets/svg/search.svg';
import { UniswapPoolInfo } from '../../../data/MarginAccount';
import SmartWalletButton from '../SmartWalletButton';

const ITEMS_PER_PAGE = 5;
const TERTIARY_COLOR = '#4b6980';

const SmartWalletOptionsPage = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  // The height of 5 buttons + gap between them
  min-height: 212px;
`;

type CreateSmartWalletButtonProps = {
  poolAddress: string;
  uniswapPoolInfo: UniswapPoolInfo;
  userAddress: Address;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

function CreateSmartWalletButton(props: CreateSmartWalletButtonProps) {
  const { poolAddress, uniswapPoolInfo, userAddress, setIsOpen, setPendingTxn } = props;
  const activeChain = useChain();

  const salt = useMemo(() => generateBytes12Salt(), []);
  const { data: createBorrowerConfig } = useSimulateContract({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'mint',
    args: [userAddress, [poolAddress as Address], [salt]],
    query: { enabled: Boolean(poolAddress) && Boolean(userAddress) },
    chainId: activeChain.id,
  });
  const { writeContractAsync: createBorrower, isPending } = useWriteContract();

  const pairLabel = `${uniswapPoolInfo.token0.symbol}/${uniswapPoolInfo.token1.symbol}`;

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      onClick={() => {
        createBorrower(createBorrowerConfig!.request)
          .then((hash) => {
            setPendingTxn(hash);
            setIsOpen(false);
          })
          .catch((e) => console.error(e));
      }}
      disabled={isPending || !createBorrowerConfig || poolAddress === ''}
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
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
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
        poolInfo.token0.symbol.toLowerCase().includes(filterInput.toLowerCase()) ||
        poolInfo.token1.symbol.toLowerCase().includes(filterInput.toLowerCase()) ||
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
            On Aloe, all borrows are managed inside smart wallets, represented by NFTs. Select a pair and mint an NFT to
            get started.
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
                  tokenId={null}
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
          <div>
            <CreateSmartWalletButton
              poolAddress={selectedPool || ''}
              uniswapPoolInfo={selectedPoolInfo}
              userAddress={userAddress}
              setIsOpen={setIsOpen}
              setPendingTxn={setPendingTxn}
            />
            <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
              By using our service, you agree to our{' '}
              <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
                Terms of Service
              </a>{' '}
              and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur.
              It is your duty to educate yourself and be aware of the risks.
            </Text>
          </div>
        )}
      </div>
    </Modal>
  );
}
