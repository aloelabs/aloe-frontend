import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput, truncateDecimals } from 'shared/lib/util/Numbers';
import { useAccount } from 'wagmi';

import { ChainContext } from '../../../App';
import { RedeemState, useRedeem } from '../../../data/hooks/UseRedeem';
import { LendingPair } from '../../../data/LendingPair';
import PairDropdown from '../../common/PairDropdown';
import Tooltip from '../../common/Tooltip';
import TokenAmountSelectInput from '../TokenAmountSelectInput';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  REDEEM_TOO_MUCH,
  READY_TO_SIGN,
  READY_TO_REDEEM,
  WAITING_FOR_TRANSACTION,
  WAITING_FOR_USER,
  LOADING,
  DISABLED,
}

const REDEEM_STATE_TO_BUTTON_STATE = {
  [RedeemState.WAITING_FOR_INPUT]: ConfirmButtonState.DISABLED,
  [RedeemState.FETCHING_DATA]: ConfirmButtonState.LOADING,
  [RedeemState.READY_TO_SIGN]: ConfirmButtonState.READY_TO_SIGN,
  [RedeemState.ASKING_USER_TO_SIGN]: ConfirmButtonState.WAITING_FOR_USER,
  [RedeemState.READY_TO_REDEEM]: ConfirmButtonState.READY_TO_REDEEM,
  [RedeemState.ASKING_USER_TO_REDEEM]: ConfirmButtonState.WAITING_FOR_USER,
};

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.REDEEM_TOO_MUCH:
      return { text: `Insufficient ${token.ticker}`, enabled: false };
    case ConfirmButtonState.READY_TO_SIGN:
      return { text: `Permit Router`, enabled: true };
    case ConfirmButtonState.READY_TO_REDEEM:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.WAITING_FOR_TRANSACTION:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.LOADING:
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

const Q112 = BigNumber.from('0x1000000000000000000000000000000');

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
  const [inputValue, setInputValue] = useState<[string, boolean]>(['', false]);
  const account = useAccount();

  function resetModal() {
    setSelectedOption(defaultOption);
    setInputValue(['', false]);
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

  const amount = GN.fromDecimalString(inputValue[0] || '0', selectedOption.decimals);

  // TODO: debounce amount to avoid repeated network requests for `convertToShares`
  const {
    state: redeemState,
    action,
    txn,
    maxAmount,
  } = useRedeem(
    activeChain,
    activeKitty ?? lendingPairs[0].kitty0,
    inputValue[1] ? GN.fromBigNumber(Q112, selectedOption.decimals) : amount,
    isOpen && account.address ? account.address : '0x0000000000000000000000000000000000000000'
  );

  useEffect(() => {
    if (txn === undefined) return;
    setPendingTxn(txn);
    setIsOpen(false);
    resetModal(); // TODO: necessary? if so what do we do about missing dep?
  }, [txn, setPendingTxn, setIsOpen]);

  if (selectedPairOption == null || activeKitty == null) {
    return null;
  }

  const peerAsset: Token =
    selectedOption.address === selectedPairOption.token0.address
      ? selectedPairOption.token1
      : selectedPairOption.token0;

  // MARK: Determining button state -----------------------------------------------------------------------------------
  let confirmButtonState: ConfirmButtonState;
  if (txn) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_TRANSACTION;
  } else if (amount.isZero()) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else if (redeemState !== RedeemState.FETCHING_DATA && amount.gt(maxAmount)) {
    confirmButtonState = ConfirmButtonState.REDEEM_TOO_MUCH;
  } else {
    confirmButtonState = REDEEM_STATE_TO_BUTTON_STATE[redeemState];
  }
  // MARK: Get the button itself --------------------------------------------------------------------------------------
  const confirmButton = getConfirmButton(confirmButtonState, selectedOption);

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
                setInputValue([maxAmount.toString(GNFormat.DECIMAL), true]);
              }}
            >
              MAX
            </BaseMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={inputValue[0]}
            options={options}
            selectedOption={selectedOption}
            onSelect={(option) => {
              setSelectedOption(option);
              setInputValue(['', false]);
            }}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, selectedOption.decimals);
                setInputValue([truncatedOutput, false]);
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
          <FilledStylizedButton size='M' onClick={() => action?.()} fillWidth={true} disabled={!confirmButton.enabled}>
            {confirmButton.text}
          </FilledStylizedButton>
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
