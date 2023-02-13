import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import FactoryABI from '../../../assets/abis/Factory.json';
import { ALOE_II_FACTORY_ADDRESS } from '../../../data/constants/Addresses';
import { UniswapPoolInfo } from '../../../data/MarginAccount';
import { getToken } from '../../../data/TokenData';
import SmartWalletButton from '../SmartWalletButton';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room

type CreateSmartWalletButtonProps = {
  poolAddress: string;
  userAddress: string;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function CreateSmartWalletButton(props: CreateSmartWalletButtonProps) {
  const { poolAddress, userAddress, setIsOpen, setPendingTxn } = props;
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

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      onClick={() => {
        setIsPending(true);
        createBorrower?.();
      }}
      disabled={isPending || poolAddress === ''}
      className='mt-16'
    >
      Create
    </FilledStylizedButton>
  );
}

export type NewSmartWalletModalProps = {
  availablePools: Map<string, UniswapPoolInfo>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function NewSmartWalletModal(props: NewSmartWalletModalProps) {
  const { availablePools, isOpen, setIsOpen, setPendingTxn } = props;

  const [selectedPool, setSelectedPool] = useState<string | null>(null);

  const { activeChain } = useContext(ChainContext);
  const { address: userAddress } = useAccount();

  if (!userAddress || !isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      title='Create a new smart wallet'
      setIsOpen={(open: boolean) => {
        setIsOpen(open);
        if (!open) setSelectedPool(null);
      }}
      maxHeight='400px'
      maxWidth='600px'
    >
      <div className='w-[550px]'>
        <div className='flex flex-col gap-4'>
          <Text size='M' weight='medium'>
            Select a pool to borrow from
          </Text>
          <div className='grid grid-cols-2 gap-2'>
            {Array.from(availablePools.entries()).map(([poolAddress, poolInfo]) => (
              <SmartWalletButton
                token0={getToken(activeChain.id, poolInfo.token0)}
                token1={getToken(activeChain.id, poolInfo.token1)}
                isActive={poolAddress === selectedPool}
                onClick={() => {
                  setSelectedPool(poolAddress);
                }}
                key={poolAddress}
              />
            ))}
          </div>
        </div>
        <CreateSmartWalletButton
          poolAddress={selectedPool ?? ''}
          userAddress={userAddress}
          setIsOpen={setIsOpen}
          setPendingTxn={setPendingTxn}
        />
      </div>
    </Modal>
  );
}
