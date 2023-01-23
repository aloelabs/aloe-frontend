import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import Big from 'big.js';
import { BigNumber, ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount, useContractRead, useContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import KittyABI from '../../../assets/abis/Kitty.json';
import { ReactComponent as AlertTriangleIcon } from '../../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../../assets/svg/check_black.svg';
import { ReactComponent as MoreIcon } from '../../../assets/svg/more_ellipses.svg';
import { Kitty } from '../../../data/Kitty';
import { LendingPair } from '../../../data/LendingPair';
import { Token } from '../../../data/Token';
import { formatNumberInput, truncateDecimals } from '../../../util/Numbers';
import PairDropdown from '../../common/PairDropdown';
import Tooltip from '../../common/Tooltip';
import TokenAmountSelectInput from '../TokenAmountSelectInput';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  APPROVE_ASSET,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(
  state: ConfirmButtonState,
  token: Token
): { text: string; Icon: ReactElement; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.ticker}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
      };
    case ConfirmButtonState.APPROVE_ASSET:
      return {
        text: `Approve ${token.ticker}`,
        Icon: <CheckIcon />,
        enabled: true,
      };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', Icon: <MoreIcon />, enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: true };
    case ConfirmButtonState.LOADING:
    default:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: false };
  }
}

type WithdrawButtonProps = {
  withdrawAmount: string;
  maxWithdrawBalance: string;
  maxRedeemBalance: string;
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
    args: [ethers.utils.parseUnits(withdrawAmount || '0.00', token.decimals).toString()],
    chainId: activeChain.id,
  });

  const {
    write: contractWrite,
    isSuccess: contractDidSucceed,
    isLoading: contractIsLoading,
    data: contractData,
  } = useContractWrite({
    address: kitty.address,
    abi: KittyABI,
    mode: 'recklesslyUnprepared',
    functionName: 'redeem',
    chainId: activeChain.id,
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

  const numericDepositBalance = Number(maxWithdrawBalance) || 0;
  const numericDepositAmount = Number(withdrawAmount) || 0;

  let confirmButtonState = ConfirmButtonState.READY;

  if (numericDepositAmount > numericDepositBalance) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (isPending || convertToSharesIsLoading) {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  function handleClickConfirm() {
    if (confirmButtonState === ConfirmButtonState.READY && requestedShares) {
      setIsPending(true);
      const numericRequestedShares = BigNumber.from(requestedShares.toString());
      const numericMaxRedeemBalance = BigNumber.from(maxRedeemBalance);
      // Being extra careful here to make sure we don't withdraw more than the user has
      const finalWithdrawAmount = numericRequestedShares.gt(numericMaxRedeemBalance)
        ? numericMaxRedeemBalance
        : numericRequestedShares;
      contractWrite?.({
        recklesslySetUnpreparedArgs: [finalWithdrawAmount.toString(), accountAddress, accountAddress],
        recklesslySetUnpreparedOverrides: { gasLimit: BigNumber.from('600000') },
      });
    }
  }

  const isDepositAmountValid = numericDepositAmount > 0;
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

  const { data: maxWithdraw } = useContractRead({
    address: activeKitty?.address,
    abi: KittyABI,
    enabled: activeKitty != null,
    functionName: 'maxWithdraw',
    chainId: activeChain.id,
    args: [account.address] as const,
    // TODO: Add an alternative to watch that doesn't re-fetch each block (because of optimism)
    // watch: true,
  });

  const { data: maxRedeem } = useContractRead({
    address: activeKitty?.address,
    abi: KittyABI,
    enabled: activeKitty != null,
    functionName: 'maxRedeem',
    chainId: activeChain.id,
    args: [account.address] as const,
    // TODO: Add an alternative to watch that doesn't re-fetch each block (because of optimism)
    // watch: true,
  });

  const maxWithdrawBalance = useMemo(() => {
    if (maxWithdraw) {
      return new Big(maxWithdraw.toString()).div(10 ** selectedOption.decimals).toString();
    }
    return '0.00';
  }, [maxWithdraw, selectedOption]);

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
                  setInputValue(maxWithdrawBalance);
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
            withdrawAmount={inputValue}
            maxWithdrawBalance={maxWithdrawBalance}
            maxRedeemBalance={maxRedeem ? maxRedeem.toString() : '0'}
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
            By withdrawing, you agree to our <a href='/earn/public/terms.pdf'>Terms of Service</a> and acknowledge that
            you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is your duty to
            educate yourself and be aware of the risks.
          </Text>
        </div>
      </div>
    </Modal>
  );
}
