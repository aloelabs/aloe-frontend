import { useEffect, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { erc20Abi } from 'shared/lib/abis/ERC20';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton, SquareInput } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN } from 'shared/lib/data/GoodNumber';
import useChain from 'shared/lib/data/hooks/UseChain';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput, truncateDecimals } from 'shared/lib/util/Numbers';
import { Address, getAddress, isAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';
import { useAccount, useBalance, useEnsAddress, useSimulateContract, useWriteContract } from 'wagmi';

import TokenAmountSelectInput from '../TokenAmountSelectInput';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INVALID_ADDRESS,
  INSUFFICIENT_ASSET,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INVALID_ADDRESS:
      return {
        text: `Couldn't resolve ENS`,
        enabled: false,
      };
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.symbol}`,
        enabled: false,
      };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type SendCryptoConfirmButtonProps = {
  sendAddress: string;
  isValidAddress: boolean;
  sendAmount: GN;
  sendBalance: GN;
  token: Token;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

function SendCryptoConfirmButton(props: SendCryptoConfirmButtonProps) {
  const { sendAddress, sendAmount, sendBalance, token, setIsOpen, setPendingTxn } = props;
  const activeChain = useChain();
  const [isPending, setIsPending] = useState(false);

  const isEns = sendAddress.endsWith('.eth');

  const { data: resolvedAddress } = useEnsAddress({
    name: isEns ? normalize(sendAddress) : '',
    chainId: mainnet.id,
    query: { enabled: isEns },
  });

  const finalAddress = isEns ? resolvedAddress : sendAddress;

  const { data: sendCryptoConfig } = useSimulateContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [finalAddress as Address, sendAmount.toBigInt()],
    chainId: activeChain.id,
    query: { enabled: sendAmount.isGtZero() && !isPending && Boolean(finalAddress) },
  });
  const {
    writeContract: contractWrite,
    isSuccess: contractDidSucceed,
    isPending: contractIsLoading,
    data: contractData,
  } = useWriteContract();

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

  if ((isEns && !resolvedAddress) || (!isEns && !isAddress(sendAddress.toLowerCase()))) {
    confirmButtonState = ConfirmButtonState.INVALID_ADDRESS;
  } else if (sendAmount.gt(sendBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  function handleClickConfirm() {
    // TODO: Do not use setStates in async functions outside of useEffect
    if (confirmButtonState === ConfirmButtonState.READY && sendCryptoConfig !== undefined) {
      setIsPending(true);
      contractWrite(sendCryptoConfig.request);
    }
  }

  const isDepositAmountValid = sendAmount.isGtZero();
  const shouldConfirmButtonBeDisabled = !(confirmButton.enabled && isDepositAmountValid);

  return (
    <FilledStylizedButton
      size='M'
      onClick={() => handleClickConfirm()}
      fillWidth={true}
      disabled={shouldConfirmButtonBeDisabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type SendCryptoModalProps = {
  isOpen: boolean;
  options: Token[];
  defaultOption: Token;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function SendCryptoModal(props: SendCryptoModalProps) {
  const { isOpen, options, defaultOption, setIsOpen, setPendingTxn } = props;
  const activeChain = useChain();
  const [selectedOption, setSelectedOption] = useState<Token>(defaultOption);
  const [addressInputValue, setAddressInputValue] = useState<string>('');
  const [sendAmountInputValue, setSendAmountInputValue] = useState<string>('');
  const account = useAccount();

  useEffect(() => {
    if (!isAddress(addressInputValue)) return;
    const checksummedAddress = getAddress(addressInputValue, activeChain.id);
    if (checksummedAddress !== addressInputValue) setAddressInputValue(checksummedAddress);
  }, [activeChain.id, addressInputValue]);

  function resetModal() {
    setSelectedOption(defaultOption);
    setAddressInputValue('');
    setSendAmountInputValue('');
  }
  // Get the user's balance of the selected token
  const { refetch: refetchDepositBalance, data: depositBalance } = useBalance({
    address: account?.address ?? '0x',
    token: selectedOption.address,
    chainId: activeChain.id,
    query: { enabled: isOpen },
  });

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    if (isOpen) {
      interval = setInterval(() => {
        refetchDepositBalance();
      }, 13_000);
    }
    if (!isOpen && interval != null) {
      clearInterval(interval);
    }
    return () => {
      if (interval != null) {
        clearInterval(interval);
      }
    };
  }, [refetchDepositBalance, isOpen]);

  useEffect(() => {
    setSelectedOption(defaultOption);
  }, [defaultOption]);

  const gnSendAmount = GN.fromDecimalString(sendAmountInputValue || '0', selectedOption.decimals);
  const gnSendBalance = GN.fromBigInt(depositBalance?.value ?? 0n, selectedOption.decimals);
  const isValidAddress = isAddress(addressInputValue) || addressInputValue.endsWith('.eth');

  const summaryText = isValidAddress
    ? `You're sending ${sendAmountInputValue || '0.00'} ${selectedOption.symbol} to ${addressInputValue || '...'}`
    : "You're not sending anything.";

  return (
    <Modal
      isOpen={isOpen}
      title='Send Crypto'
      setIsOpen={(open: boolean) => {
        setIsOpen(open);
        if (!open) {
          resetModal();
        }
      }}
      maxWidth='550px'
    >
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Send to
            </Text>
          </div>
          <SquareInput
            size='L'
            value={addressInputValue}
            inputClassName={addressInputValue !== '' ? 'active' : ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setAddressInputValue(e.target.value);
            }}
            fullWidth={true}
            paddingRightOverride='24px'
            placeholder='Enter address'
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Amount
            </Text>
            <BaseMaxButton
              size='L'
              onClick={() => {
                if (depositBalance != null) {
                  setSendAmountInputValue(depositBalance?.formatted);
                }
              }}
            >
              MAX
            </BaseMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={sendAmountInputValue}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, selectedOption.decimals);
                setSendAmountInputValue(truncatedOutput);
              }
            }}
            options={options}
            onSelect={setSelectedOption}
            selectedOption={selectedOption}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            {summaryText}
          </Text>
        </div>
        <div className='w-full'>
          <SendCryptoConfirmButton
            sendAddress={addressInputValue}
            isValidAddress={isValidAddress}
            sendAmount={gnSendAmount}
            sendBalance={gnSendBalance}
            token={selectedOption}
            setIsOpen={(open: boolean) => {
              setIsOpen(open);
              if (!open) {
                resetModal();
              }
            }}
            setPendingTxn={setPendingTxn}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By sending, you agree to our{' '}
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
