import { useCallback, useContext, useEffect, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import Tooltip from 'shared/lib/components/common/Tooltip';
import { Text } from 'shared/lib/components/common/Typography';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput, truncateDecimals } from 'shared/lib/util/Numbers';
import { useAccount } from 'wagmi';

import { ChainContext } from '../../../App';
import { ZERO_ADDRESS } from '../../../data/constants/Addresses';
import { RedeemState, useRedeem } from '../../../data/hooks/UseRedeem';
import { LendingPair } from '../../../data/LendingPair';
import { TokenBalance } from '../../../pages/PortfolioPage';
import PairDropdown from '../../common/PairDropdown';
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
      return { text: `Insufficient ${token.symbol}`, enabled: false };
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

function doesLendingPairContainToken(pair: LendingPair, token: Token) {
  return pair.token0.equals(token) || pair.token1.equals(token);
}

export type WithdrawModalProps = {
  isOpen: boolean;
  tokens: Token[];
  defaultToken: Token;
  lendingPairs: LendingPair[];
  tokenBalances: TokenBalance[];
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function WithdrawModal(props: WithdrawModalProps) {
  const { isOpen, tokens, defaultToken, lendingPairs, tokenBalances, setIsOpen, setPendingTxn } = props;

  const { activeChain } = useContext(ChainContext);

  const [selectedToken, setSelectedToken] = useState(defaultToken);
  const [selectedPairIdx, setSelectedPairIdx] = useState(0);
  const [inputValue, setInputValue] = useState<[string, boolean]>(['', false]); // [amountStr, isMaxed]
  const account = useAccount();

  const filteredPairs = lendingPairs.filter((p) => doesLendingPairContainToken(p, selectedToken));
  const filteredTokenBalances = tokenBalances.filter((tb) => tb.isKitty && tb.token.underlying.equals(selectedToken));
  const sortedPairs = filteredPairs.sort((a, b) => {
    const aBalance =
      filteredTokenBalances.find((tb) => tb.token.equals(a.kitty0) || tb.token.equals(a.kitty1))?.balance ?? 0;
    const bBalance =
      filteredTokenBalances.find((tb) => tb.token.equals(b.kitty0) || tb.token.equals(b.kitty1))?.balance ?? 0;
    return bBalance - aBalance;
  });
  const selectedPair = sortedPairs.at(selectedPairIdx);
  const lender = selectedPair?.token0.equals(selectedToken) ? selectedPair.kitty0 : selectedPair?.kitty1;
  const amount = GN.fromDecimalString(inputValue[0] || '0', selectedToken.decimals);

  // TODO: debounce amount to avoid repeated network requests for `convertToShares`
  const {
    state: redeemState,
    action,
    txn,
    resetTxn,
    maxAmount: maxAmountBN,
  } = useRedeem(
    activeChain.id,
    lender?.address,
    inputValue[1] ? GN.Q(112) : amount,
    isOpen && account.address ? account.address : ZERO_ADDRESS
  );
  const maxAmount = GN.fromBigNumber(maxAmountBN, selectedToken.decimals);

  /*//////////////////////////////////////////////////////////////
                              LIFECYCLE
  //////////////////////////////////////////////////////////////*/

  const resetUserInputs = useCallback(() => {
    setSelectedToken(defaultToken);
    setInputValue(['', false]);
  }, [setSelectedToken, setInputValue, defaultToken]);

  useEffect(() => {
    if (txn === undefined) return;
    setPendingTxn(txn);
    resetTxn();
    setIsOpen(false);
    resetUserInputs();
  }, [txn, setPendingTxn, resetTxn, setIsOpen, resetUserInputs]);

  useEffect(() => {
    resetUserInputs();
  }, [activeChain.id, resetUserInputs]);

  /*//////////////////////////////////////////////////////////////
                            CONFIRM BUTTON
  //////////////////////////////////////////////////////////////*/

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
  const confirmButton = getConfirmButton(confirmButtonState, selectedToken);

  if (selectedPair === undefined) return null;

  return (
    <Modal
      isOpen={isOpen}
      title='Withdraw'
      setIsOpen={(open: boolean) => {
        setIsOpen(open);
        if (!open) {
          resetUserInputs();
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
            options={tokens}
            selectedOption={selectedToken}
            onSelect={(option) => {
              // Reset the selected pair
              setSelectedPairIdx(0);
              setSelectedToken(option);
              setInputValue(['', false]);
            }}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, selectedToken.decimals);
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
              content={`When you deposited ${selectedToken.symbol} to Aloe, you chose to lend to a particular pair.
              Choose the same pair now in order to withdraw.`}
              position='top-center'
              filled={true}
            />
          </div>
          <PairDropdown
            options={sortedPairs}
            onSelect={(a) => setSelectedPairIdx(sortedPairs.findIndex((b) => a.equals(b)))}
            selectedOption={selectedPair}
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
              {inputValue[0] || '0.00'} {selectedToken.symbol}
            </strong>{' '}
            from the{' '}
            <strong>
              {selectedPair.token0.symbol}/{selectedPair.token1.symbol}
            </strong>{' '}
            lending market.
          </Text>
        </div>
        <div className='w-full'>
          <FilledStylizedButton size='M' onClick={() => action?.()} fillWidth={true} disabled={!confirmButton.enabled}>
            {confirmButton.text}
          </FilledStylizedButton>
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By using our interface, you agree to our{' '}
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
