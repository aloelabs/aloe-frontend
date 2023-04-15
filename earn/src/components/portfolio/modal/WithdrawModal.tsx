import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import Big from 'big.js';
import { BigNumber, ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import KittyABI from '../../../assets/abis/Kitty.json';
import { Kitty } from '../../../data/Kitty';
import { LendingPair } from '../../../data/LendingPair';
import { Token } from '../../../data/Token';
import { formatNumberInput, truncateDecimals } from '../../../util/Numbers';
import PairDropdown from '../../common/PairDropdown';
import Tooltip from '../../common/Tooltip';
import TokenAmountSelectInput from '../TokenAmountSelectInput';

const GAS_ESTIMATE_WIGGLE_ROOM = 110;
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  APPROVE_ASSET,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.ticker}`,
        enabled: false,
      };
    case ConfirmButtonState.APPROVE_ASSET:
      return {
        text: `Approve ${token.ticker}`,
        enabled: true,
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

type WithdrawButtonProps = {
  withdrawAmount: Big;
  maxWithdrawBalance: Big;
  maxRedeemBalance: Big;
  token: Token;
  kitty: Kitty;
  accountAddress: string;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function WithdrawButton(props: WithdrawButtonProps) {
  const {
    withdrawAmount,
    maxWithdrawBalance,
    maxRedeemBalance,
    token,
    kitty,
    accountAddress,
    setIsOpen,
    setPendingTxn,
  } = props;
  const { activeChain } = useContext(ChainContext);
  const [isPending, setIsPending] = useState(false);

  const { data: requestedShares, isLoading: convertToSharesIsLoading } = useContractRead({
    address: kitty.address,
    abi: KittyABI,
    functionName: 'convertToShares',
    args: [ethers.utils.parseUnits(withdrawAmount.toFixed(token.decimals), token.decimals)],
    chainId: activeChain.id,
  });

  const numericRequestedShares = requestedShares ? BigNumber.from(requestedShares.toString()) : BigNumber.from(0);
  const numericMaxRedeemBalance = BigNumber.from(maxRedeemBalance.toFixed());
  // Being extra careful here to make sure we don't withdraw more than the user has
  const finalWithdrawAmount = numericRequestedShares.gt(numericMaxRedeemBalance)
    ? numericMaxRedeemBalance
    : numericRequestedShares;

  const { config: withdrawConfig } = usePrepareContractWrite({
    address: kitty.address,
    abi: KittyABI,
    functionName: 'redeem',
    args: [finalWithdrawAmount.toString(), accountAddress, accountAddress],
    chainId: activeChain.id,
    enabled: finalWithdrawAmount.gt(0) && !isPending,
  });
  const withdrawUpdatedRequest = useMemo(() => {
    if (withdrawConfig.request) {
      return {
        ...withdrawConfig.request,
        gasLimit: withdrawConfig.request.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100),
      };
    }
    return undefined;
  }, [withdrawConfig.request]);
  const {
    write: contractWrite,
    isSuccess: contractDidSucceed,
    isLoading: contractIsLoading,
    data: contractData,
  } = useContractWrite({
    ...withdrawConfig,
    request: withdrawUpdatedRequest,
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

  if (withdrawAmount.gt(maxWithdrawBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (isPending || convertToSharesIsLoading) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (finalWithdrawAmount.eq(0)) {
    confirmButtonState = ConfirmButtonState.LOADING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  function handleClickConfirm() {
    if (confirmButtonState === ConfirmButtonState.READY && requestedShares) {
      setIsPending(true);
      contractWrite?.();
    }
  }

  const isDepositAmountValid = withdrawAmount.gt(0);
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

export type WithdrawModalProps = {
  isOpen: boolean;
  options: Token[];
  defaultOption: Token;
  lendingPairs: LendingPair[];
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function WithdrawModal(props: WithdrawModalProps) {
  const { isOpen, options, defaultOption, lendingPairs, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [selectedOption, setSelectedOption] = useState<Token>(defaultOption);
  const [activePairOptions, setActivePairOptions] = useState<LendingPair[]>([]);
  const [selectedPairOption, setSelectedPairOption] = useState<LendingPair | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const account = useAccount();

  function resetModal() {
    setSelectedOption(defaultOption);
    setInputValue('');
  }

  useEffect(() => {
    const activeCollateralOptions = lendingPairs.filter(
      (pair) => pair.token0 === selectedOption || pair.token1 === selectedOption
    );
    setActivePairOptions(activeCollateralOptions);
    setSelectedPairOption(activeCollateralOptions[0]);
  }, [lendingPairs, selectedOption]);

  useEffect(() => {
    setSelectedOption(defaultOption);
  }, [defaultOption]);

  // Get the active kitty that corresponds to the selected token and is in
  // the selected token / collateral token lending pair
  let activeKitty: Kitty | null = useMemo(() => {
    for (const lendingPair of lendingPairs) {
      if (selectedPairOption?.equals(lendingPair)) {
        return lendingPair.token0.address === selectedOption.address ? lendingPair.kitty0 : lendingPair.kitty1;
      }
    }
    return null;
  }, [selectedPairOption, selectedOption, lendingPairs]);

  const { refetch: refetchMaxWithdraw, data: maxWithdraw } = useContractRead({
    address: activeKitty?.address,
    abi: KittyABI,
    enabled: activeKitty != null && account.address !== undefined && isOpen,
    functionName: 'maxWithdraw',
    chainId: activeChain.id,
    args: [account.address] as const,
  });

  const { refetch: refetchMaxRedeem, data: maxRedeem } = useContractRead({
    address: activeKitty?.address,
    abi: KittyABI,
    enabled: activeKitty != null && account.address !== undefined && isOpen,
    functionName: 'maxRedeem',
    chainId: activeChain.id,
    args: [account.address] as const,
  });

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    if (isOpen) {
      interval = setInterval(() => {
        refetchMaxWithdraw();
        refetchMaxRedeem();
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
  }, [refetchMaxWithdraw, refetchMaxRedeem, isOpen]);

  const bigWithdrawAmount = inputValue ? new Big(inputValue) : new Big(0);
  const bigMaxWithdraw: Big = maxWithdraw ? new Big(maxWithdraw.toString()) : new Big(0);
  const bigMaxRedeem: Big = maxRedeem ? new Big(maxRedeem.toString()) : new Big(0);

  if (selectedPairOption == null || activeKitty == null) {
    return null;
  }

  const peerAsset: Token =
    selectedOption.address === selectedPairOption.token0.address
      ? selectedPairOption.token1
      : selectedPairOption.token0;

  return (
    <Modal
      isOpen={isOpen}
      title='Withdraw'
      setIsOpen={(open: boolean) => {
        setIsOpen(open);
        if (!open) {
          resetModal();
        }
      }}
    >
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Amount
            </Text>
            <BaseMaxButton
              size='L'
              onClick={() => {
                if (maxWithdraw) {
                  setInputValue(bigMaxWithdraw.div(10 ** selectedOption.decimals).toFixed());
                }
              }}
            >
              MAX
            </BaseMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={inputValue}
            options={options}
            selectedOption={selectedOption}
            onSelect={(option) => {
              setSelectedOption(option);
              setInputValue('');
            }}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, selectedOption.decimals);
                setInputValue(truncatedOutput);
              }
            }}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex items-center gap-2'>
            <Text size='M' weight='bold'>
              Lending Pair
            </Text>
            <Tooltip
              buttonSize='S'
              buttonText=''
              content={`The lending pair is the combination of the asset you are withdrawing
                and the collateral you are using to withdraw it.`}
              position='top-center'
              filled={true}
            />
          </div>
          <PairDropdown
            options={activePairOptions}
            onSelect={setSelectedPairOption}
            selectedOption={selectedPairOption}
            size='L'
            compact={false}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're withdrawing{' '}
            <strong>
              {inputValue || '0.00'} {selectedOption.ticker}
            </strong>{' '}
            from the{' '}
            <strong>
              {selectedOption.ticker}/{peerAsset.ticker}
            </strong>{' '}
            lending market.
          </Text>
        </div>
        <div className='w-full'>
          <WithdrawButton
            withdrawAmount={bigWithdrawAmount}
            maxWithdrawBalance={bigMaxWithdraw}
            maxRedeemBalance={bigMaxRedeem}
            token={selectedOption}
            kitty={activeKitty}
            accountAddress={account.address ?? '0x'}
            setIsOpen={(open: boolean) => {
              setIsOpen(open);
              if (!open) {
                resetModal();
              }
            }}
            setPendingTxn={setPendingTxn}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By withdrawing, you agree to our{' '}
            <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
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
