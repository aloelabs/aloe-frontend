import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import FactoryABI from '../../../assets/abis/Factory.json';
import { ALOE_II_FACTORY_ADDRESS } from '../../../data/constants/Addresses';

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
      disabled={isPending}
      className='mt-16'
    >
      Create
    </FilledStylizedButton>
  );
}

export type NewSmartWalletModalProps = {
  availablePoolOptions: DropdownOption<string>[];
  defaultOption: DropdownOption<string>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function NewSmartWalletModal(props: NewSmartWalletModalProps) {
  const { availablePoolOptions, defaultOption, isOpen, setIsOpen, setPendingTxn } = props;

  const [selectedPoolOption, setSelectedPoolOption] = useState<DropdownOption<string>>(defaultOption);

  const { address: userAddress } = useAccount();

  const resetModal = () => {
    setSelectedPoolOption(defaultOption);
  };

  if (!userAddress || !isOpen) {
    return null;
  }

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
      maxHeight='650px'
    >
      <div className='w-full'>
        <div className='flex flex-col gap-4'>
          <Text size='M' weight='medium'>
            Select a pool to borrow from
          </Text>
          <Dropdown
            options={availablePoolOptions}
            onSelect={(option: DropdownOption<string>) => {
              setSelectedPoolOption(option);
            }}
            selectedOption={selectedPoolOption}
          />
        </div>
        <CreateSmartWalletButton
          poolAddress={selectedPoolOption.value}
          userAddress={userAddress}
          setIsOpen={setIsOpen}
          setPendingTxn={setPendingTxn}
        />
      </div>
    </Modal>
  );
}
