import { useCallback, useContext, useEffect, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput, truncateDecimals } from 'shared/lib/util/Numbers';
import { useAccount } from 'wagmi';

import { ChainContext } from '../../../App';
import { RedeemState, useRedeem } from '../../../data/hooks/UseRedeem';
import { LendingPair, LendingPairBalances } from '../../../data/LendingPair';
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

function doesContainToken(token: Token, pair: LendingPair) {
  return pair.token0.equals(token) || pair.token1.equals(token);
}

export type WithdrawModalProps = {
  isOpen: boolean;
  tokens: Token[];
  defaultToken: Token;
  lendingPairs: LendingPair[];
  lendingPairBalances: LendingPairBalances[];
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function WithdrawModal(props: WithdrawModalProps) {
  const { isOpen, tokens, defaultToken, lendingPairs, lendingPairBalances, setIsOpen, setPendingTxn } = props;

  const { activeChain } = useContext(ChainContext);

  const [selectedToken, setSelectedToken] = useState(defaultToken);
  const [selectedPairIdx, setSelectedPairIdx] = useState(0);
  const [inputValue, setInputValue] = useState<[string, boolean]>(['', false]);
  const account = useAccount();

  const mergedPairData = lendingPairs.map((pair, i) => ({ pair, balances: lendingPairBalances[i] }));
  const filteredPairs = mergedPairData
    .filter((v) => doesContainToken(selectedToken, v.pair))
    .sort((a, b) => {
      const balanceA = a.balances[a.pair.token0.equals(selectedToken) ? 'kitty0Balance' : 'kitty1Balance'];
      const balanceB = b.balances[b.pair.token0.equals(selectedToken) ? 'kitty0Balance' : 'kitty1Balance'];
      return balanceB - balanceA;
    })
    .map((v) => v.pair);
  if (filteredPairs.length === 0) throw new Error(`${selectedToken.ticker} isn't part of any lending pair`);
  const selectedPair = filteredPairs.at(selectedPairIdx) ?? filteredPairs[0];
  const lender = selectedPair.token0.equals(selectedToken) ? selectedPair.kitty0 : selectedPair.kitty1;
  const amount = GN.fromDecimalString(inputValue[0] || '0', selectedToken.decimals);

  // TODO: debounce amount to avoid repeated network requests for `convertToShares`
  const {
    state: redeemState,
    action,
    txn,
    maxAmount: maxAmountBN,
  } = useRedeem(
    activeChain.id,
    lender.address,
    inputValue[1] ? GN.fromBigNumber(Q112, selectedToken.decimals) : amount,
    isOpen && account.address ? account.address : '0x0000000000000000000000000000000000000000'
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
    setIsOpen(false);
    resetUserInputs();
  }, [txn, setPendingTxn, setIsOpen, resetUserInputs]);

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

  /*//////////////////////////////////////////////////////////////
                                HTML
  //////////////////////////////////////////////////////////////*/

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
          <Text size='M' weight='bold'>
            Lending Pair
          </Text>
          <PairDropdown
            options={filteredPairs}
            onSelect={(a) => setSelectedPairIdx(filteredPairs.findIndex((b) => a.equals(b)))}
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
              {inputValue[0] || '0.00'} {selectedToken.ticker}
            </strong>{' '}
            from the{' '}
            <strong>
              {selectedPair.token0.ticker}/{selectedPair.token1.ticker}
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
