import { useEffect, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { badDebtProcessorAbi } from 'shared/lib/abis/BadDebtProcessor';
import { lenderAbi } from 'shared/lib/abis/Lender';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import useChain from 'shared/lib/hooks/UseChain';
import { PermitState, usePermit } from 'shared/lib/hooks/UsePermit';
import { Address, Hex } from 'viem';
import { base } from 'viem/chains';
import { useReadContract, useSimulateContract, useWriteContract } from 'wagmi';

import AddressDropdown from '../../common/AddressDropdown';
import MaxSlippageInput from '../../common/MaxSlippageInput';
import { SupplyTableRow } from '../supply/SupplyTable';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

export const ALOE_II_BAD_DEBT_LENDERS: { [chainId: number]: string[] } = {
  [base.id]: ['0x25D3C4a59AC57D725dBB4a4EB42BADcF20F37bcD'.toLowerCase()],
};

const ALOE_II_BAD_DEBT_PROCESSOR: { [chainId: number]: Address } = {
  [base.id]: '0x8B8eD03dcDa4A4582FD3D395a84F77A334335416',
};

const OPTIONS: { [chainId: number]: { borrower: Address; flashPool: Address }[] } = {
  [base.id]: [
    {
      borrower: '0xC7Cdda63Bf761c663FD7058739be847b422aA5A2',
      flashPool: '0x20E068D76f9E90b90604500B84c7e19dCB923e7e',
    },
  ],
};

enum ConfirmButtonState {
  READY_TO_SIGN,
  READY_TO_REDEEM,
  WAITING_FOR_TRANSACTION,
  WAITING_FOR_USER,
  LOADING,
  DISABLED,
}

const PERMIT_STATE_TO_BUTTON_STATE = {
  [PermitState.FETCHING_DATA]: ConfirmButtonState.LOADING,
  [PermitState.READY_TO_SIGN]: ConfirmButtonState.READY_TO_SIGN,
  [PermitState.ASKING_USER_TO_SIGN]: ConfirmButtonState.WAITING_FOR_USER,
  [PermitState.ERROR]: ConfirmButtonState.DISABLED,
  [PermitState.DONE]: ConfirmButtonState.DISABLED,
  [PermitState.DISABLED]: ConfirmButtonState.DISABLED,
};

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.READY_TO_SIGN:
      return { text: `Permit Recovery`, enabled: true };
    case ConfirmButtonState.READY_TO_REDEEM:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.WAITING_FOR_TRANSACTION:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading', enabled: false };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

export default function RecoverModal({
  isOpen,
  selectedRow,
  userAddress,
  setIsOpen,
  setPendingTxn,
}: {
  isOpen: boolean;
  selectedRow: SupplyTableRow;
  userAddress: Address;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
}) {
  const activeChain = useChain();
  const [selectedOption, setSelectedOption] = useState(OPTIONS[activeChain.id][0]);
  const [slippage, setSlippage] = useState('0.10');

  const { data: balanceResult } = useReadContract({
    abi: lenderAbi,
    address: selectedRow.kitty.address,
    functionName: 'balanceOf',
    args: [userAddress],
    query: {
      enabled: isOpen,
      refetchInterval: 3_000,
      refetchIntervalInBackground: false,
    },
  });

  const {
    state: permitState,
    action: permitAction,
    result: permitResult,
  } = usePermit(
    activeChain.id,
    selectedRow.kitty.address,
    userAddress,
    ALOE_II_BAD_DEBT_PROCESSOR[activeChain.id],
    balanceResult?.toString(10) ?? '0',
    isOpen && balanceResult !== undefined
  );

  const {
    data: configRecover,
    error: errorRecover,
    isLoading: loadingRecover,
  } = useSimulateContract({
    chainId: activeChain.id,
    abi: badDebtProcessorAbi,
    address: ALOE_II_BAD_DEBT_PROCESSOR[activeChain.id],
    functionName: 'processWithPermit',
    args: [
      selectedRow.kitty.address,
      selectedOption.borrower,
      selectedOption.flashPool,
      BigInt((Number(slippage) * 100).toFixed(0)),
      balanceResult ?? 0n,
      BigInt(permitResult.deadline),
      permitResult.signature?.v ?? 0,
      (permitResult.signature?.r ?? '0x0') as Hex,
      (permitResult.signature?.s ?? '0x0') as Hex,
    ],
    query: { enabled: isOpen && permitResult.signature !== undefined },
  });

  const { writeContract: recover, data: txn, isPending, reset: resetTxn } = useWriteContract();

  useEffect(() => {
    if (txn === undefined) return;
    setPendingTxn(txn);
    resetTxn();
    setIsOpen(false);
  }, [txn, setPendingTxn, resetTxn, setIsOpen]);

  let confirmButtonState: ConfirmButtonState;
  if (isPending || txn) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_TRANSACTION;
  } else if (configRecover !== undefined) {
    confirmButtonState = ConfirmButtonState.READY_TO_REDEEM;
  } else if (balanceResult === undefined || loadingRecover) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else {
    confirmButtonState = PERMIT_STATE_TO_BUTTON_STATE[permitState];
  }
  const confirmButton = getConfirmButton(confirmButtonState, selectedRow.asset);

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Recover'>
      <div className='w-full flex flex-col gap-4'>
        <Text size='M' weight='bold'>
          Select a borrower with bad debt:
        </Text>
        <AddressDropdown
          size='M'
          options={OPTIONS[activeChain.id].map((option) => option.borrower)}
          selectedOption={selectedOption.borrower}
          onSelect={(borrowerAddress) =>
            setSelectedOption(OPTIONS[activeChain.id].find((option) => option.borrower === borrowerAddress)!)
          }
        />
        <MaxSlippageInput updateMaxSlippage={setSlippage} />
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Explanation
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            Standard withdrawals are impossible right now due to bad debt. You can, however, get a portion of your funds
            back by simultaenously withdrawing and liquidating the problematic borrower. Note that you'll receive a
            combination of {selectedRow.collateralAssets[0].symbol} and {selectedRow.collateralAssets[1].symbol} instead
            of just {selectedRow.kitty.underlying.symbol}. This method is experimental, so we encourage you to triple
            check the transaction simulation results in a wallet like Rabby. Please reach out in Discord if you have
            questions.
          </Text>
        </div>
        <FilledStylizedButton
          size='M'
          onClick={() => {
            if (permitAction) permitAction();
            else if (configRecover) {
              recover(configRecover.request);
            }
          }}
          fillWidth={true}
          disabled={!confirmButton.enabled}
        >
          {confirmButton.text}
        </FilledStylizedButton>
      </div>
      {errorRecover && (
        <Text size='XS' color={'rgba(234, 87, 87, 0.75)'} className='w-full mt-2'>
          {errorRecover.message}
        </Text>
      )}
    </Modal>
  );
}
