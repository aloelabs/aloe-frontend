import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber, ethers } from 'ethers';
import { erc20Abi } from 'shared/lib/abis/ERC20';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton, SquareInput } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput, truncateDecimals } from 'shared/lib/util/Numbers';
import { Address, useAccount, useBalance, useContractWrite, usePrepareContractWrite, useProvider } from 'wagmi';

import { ChainContext } from '../../../App';
import TokenAmountSelectInput from '../TokenAmountSelectInput';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room
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
        text: `Invalid Address`,
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
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function SendCryptoConfirmButton(props: SendCryptoConfirmButtonProps) {
  const { sendAddress, sendAmount, sendBalance, token, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const provider = useProvider({ chainId: activeChain.id });

  useEffect(() => {
    let mounted = true;
    async function resolveEns() {
      const resolved = await provider.resolveName(sendAddress);
      if (mounted) {
        setResolvedAddress(resolved);
      }
    }
    // If the address could be valid, resolve it, otherwise set it to null
    if (sendAddress.endsWith('.eth') || sendAddress.length === 42) {
      resolveEns();
    } else {
      setResolvedAddress(null);
    }
    return () => {
      mounted = false;
    };
  }, [sendAddress, provider]);

  const { config: sendCryptoConfig } = usePrepareContractWrite({
    address: token.address,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [resolvedAddress as Address, sendAmount.toBigNumber()],
    chainId: activeChain.id,
    enabled: sendAmount.isGtZero() && !isPending && resolvedAddress != null,
  });
  const sendCryptoUpdatedRequest = useMemo(() => {
    if (sendCryptoConfig.request) {
      return {
        ...sendCryptoConfig.request,
        gasLimit: sendCryptoConfig.request.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100),
      };
    }
    return undefined;
  }, [sendCryptoConfig.request]);
  const {
    write: contractWrite,
    isSuccess: contractDidSucceed,
    isLoading: contractIsLoading,
    data: contractData,
  } = useContractWrite({
    ...sendCryptoConfig,
    request: sendCryptoUpdatedRequest,
  });

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

  if (resolvedAddress == null) {
    confirmButtonState = ConfirmButtonState.INVALID_ADDRESS;
  } else if (sendAmount.gt(sendBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  function handleClickConfirm() {
    // TODO: Do not use setStates in async functions outside of useEffect
    if (confirmButtonState === ConfirmButtonState.READY) {
      setIsPending(true);
      contractWrite?.();
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
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function SendCryptoModal(props: SendCryptoModalProps) {
  const { isOpen, options, defaultOption, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [selectedOption, setSelectedOption] = useState<Token>(defaultOption);
  const [addressInputValue, setAddressInputValue] = useState<string>('');
  const [sendAmountInputValue, setSendAmountInputValue] = useState<string>('');
  const account = useAccount();

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
    enabled: isOpen,
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
  const gnSendBalance = GN.fromBigNumber(depositBalance?.value ?? BigNumber.from('0'), selectedOption.decimals);
  const isValidAddress = ethers.utils.isAddress(addressInputValue) || addressInputValue.endsWith('.eth');
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
            You're sending {sendAmountInputValue || '0.00'} {selectedOption.symbol} to {addressInputValue || '...'}
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
