import { useContext } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { ethers } from 'ethers';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import {
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import useChain from 'shared/lib/data/hooks/UseChain';
import { Address, Chain } from 'viem';
import { useAccount, useBalance, useSimulateContract, useWriteContract } from 'wagmi';

import { BorrowerNftBorrower } from '../../../data/BorrowerNft';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  WAITING_FOR_USER,
  READY,
  LOADING,
  DISABLED,
  UNABLE_TO_WITHDRAW_ANTE,
}

function getConfirmButton(state: ConfirmButtonState): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading...', enabled: false };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type WithdrawAnteButtonProps = {
  activeChain: Chain;
  borrower: BorrowerNftBorrower;
  userAddress: Address;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: WriteContractReturnType | null) => void;
};

function WithdrawAnteButton(props: WithdrawAnteButtonProps) {
  const { activeChain, borrower, userAddress, setIsOpen, setPendingTxn } = props;

  const { data: borrowerBalance } = useBalance({
    address: borrower.address,
    chainId: activeChain.id,
  });

  const borrowerInterface = new ethers.utils.Interface(borrowerAbi);
  const encodedData = borrowerInterface.encodeFunctionData('transferEth', [borrowerBalance?.value ?? 0, userAddress]);

  const {
    data: withdrawAnteConfig,
    isError: isUnableToWithdrawAnte,
    isLoading: isCheckingIfAbleToWithdrawAnte,
  } = useSimulateContract({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      userAddress,
      [borrower.index],
      [ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS[activeChain.id]],
      [encodedData as `0x${string}`],
      [0],
    ],
    query: { enabled: Boolean(userAddress) },
    chainId: activeChain.id,
  });
  const { writeContractAsync: withdrawAnte, isPending: contractIsLoading } = useWriteContract();

  let confirmButtonState: ConfirmButtonState;
  if (contractIsLoading) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_USER;
  } else if (isUnableToWithdrawAnte) {
    confirmButtonState = ConfirmButtonState.UNABLE_TO_WITHDRAW_ANTE;
  } else if (isCheckingIfAbleToWithdrawAnte) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else {
    confirmButtonState = ConfirmButtonState.READY;
  }

  const confirmButton = getConfirmButton(confirmButtonState);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      disabled={!confirmButton.enabled}
      onClick={() => {
        if (withdrawAnteConfig)
          withdrawAnte(withdrawAnteConfig.request).then((hash) => {
            setIsOpen(false);
            setPendingTxn(hash);
          });
      }}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type WithdrawAnteModalProps = {
  borrower: BorrowerNftBorrower;
  accountEthBalance?: GN;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function WithdrawAnteModal(props: WithdrawAnteModalProps) {
  const { borrower, accountEthBalance, isOpen, setIsOpen, setPendingTxn } = props;
  const activeChain = useChain();
  const { address: userAddress } = useAccount();

  if (!userAddress || !accountEthBalance) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} title='Withdraw Ante' setIsOpen={setIsOpen} maxHeight='650px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're about to withdraw your {accountEthBalance.toString(GNFormat.DECIMAL)} ETH Ante from this smart
            wallet.
          </Text>
        </div>
        <div className='w-full'>
          <WithdrawAnteButton
            activeChain={activeChain}
            borrower={borrower}
            userAddress={userAddress}
            setIsOpen={setIsOpen}
            setPendingTxn={setPendingTxn}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By using our service, you agree to our{' '}
            <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
              Terms of Service
            </a>{' '}
            and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It
            is your duty to educate yourself and be aware of the risks.
          </Text>
        </div>
      </div>
    </Modal>
  );
}
