import { useContext, useEffect, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput } from 'shared/lib/util/Numbers';
import { Address } from 'wagmi';

import { ChainContext } from '../../../App';
import { RedeemState, useRedeem } from '../../../data/hooks/UseRedeem';
import { useBalanceOfUnderlying } from '../../../data/hooks/UseUnderlyingBalanceOf';
import { TokenIconsWithTooltip } from '../../common/TokenIconsWithTooltip';
import { SupplyTableRow } from '../SupplyTable';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
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

export type WithdrawModalProps = {
  isOpen: boolean;
  selectedRow: SupplyTableRow;
  userAddress: Address;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function WithdrawModal(props: WithdrawModalProps) {
  const { isOpen, selectedRow, userAddress, setIsOpen, setPendingTxn } = props;
  const [inputValue, setInputValue] = useState<[string, boolean]>(['', false]); // [amountStr, isMaxed]
  const { activeChain } = useContext(ChainContext);

  const { data: balanceResult, refetch: refetchBalance } = useBalanceOfUnderlying(
    selectedRow.asset,
    selectedRow.kitty.address,
    userAddress
  );

  const withdrawAmount = GN.fromDecimalString(inputValue[0] || '0', selectedRow.asset.decimals);
  const userBalance = GN.fromDecimalString(balanceResult || '0', selectedRow.asset.decimals);

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    interval = setInterval(() => refetchBalance(), 13_000);
    return () => {
      if (interval != null) {
        clearInterval(interval);
      }
    };
  }, [refetchBalance]);

  const {
    state: redeemState,
    action,
    txn,
    resetTxn,
    maxAmount,
  } = useRedeem(activeChain.id, selectedRow.kitty.address, inputValue[1] ? GN.Q(112) : withdrawAmount, userAddress);

  const maxAmountGN = GN.fromBigNumber(maxAmount, selectedRow.asset.decimals);
  const isConstrainedByUtilization =
    inputValue[1] &&
    userBalance.isGtZero() &&
    maxAmountGN.isGtZero() &&
    maxAmountGN.recklessMul(100).div(userBalance).toNumber() < 99;

  useEffect(() => {
    if (txn === undefined) return;
    setPendingTxn(txn);
    resetTxn();
    setIsOpen(false);
    setInputValue(['', false]);
  }, [txn, setPendingTxn, resetTxn, setIsOpen]);

  useEffect(() => {
    setInputValue(['', false]);
  }, [activeChain.id]);

  let confirmButtonState: ConfirmButtonState;
  if (txn) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_TRANSACTION;
  } else if (withdrawAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else if (redeemState !== RedeemState.FETCHING_DATA && withdrawAmount.gt(userBalance)) {
    confirmButtonState = ConfirmButtonState.REDEEM_TOO_MUCH;
  } else {
    confirmButtonState = REDEEM_STATE_TO_BUTTON_STATE[redeemState];
  }
  const confirmButton = getConfirmButton(confirmButtonState, selectedRow.asset);

  const newBalanceStr = GN.max(userBalance.sub(withdrawAmount), GN.zero(selectedRow.asset.decimals)).toString(
    GNFormat.DECIMAL
  );

  // TODO add a message if the use is not able to withdraw everything which explains why

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Withdraw'>
      <div className='w-full flex flex-col gap-4'>
        <TokenAmountInput
          token={selectedRow.asset}
          value={inputValue[0]}
          max={userBalance.toString(GNFormat.DECIMAL)}
          maxed={withdrawAmount.eq(maxAmountGN)}
          onMax={() => {
            setInputValue([maxAmountGN.toString(GNFormat.DECIMAL), true]);
          }}
          onChange={(value) => {
            const output = formatNumberInput(value);
            if (output != null) {
              setInputValue([output, false]);
            }
          }}
        />
        <div>
          <Text size='M' weight='bold'>
            Collateral Assets
          </Text>
          <div className='w-full flex justify-start p-2'>
            <TokenIconsWithTooltip tokens={selectedRow.collateralAssets} width={24} height={24} />
          </div>
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're withdrawing{' '}
            <strong>
              {inputValue[0] || '0'} {selectedRow.asset.symbol}.
            </strong>{' '}
            {isConstrainedByUtilization
              ? // eslint-disable-next-line max-len
                `This will cause the interest rate to spike, encouraging borrowers to repay. Once they do, you'll be able to withdraw your remaining `
              : `Your remaining balance will be `}
            {newBalanceStr} {selectedRow.asset.symbol}.
          </Text>
        </div>
        <FilledStylizedButton size='M' onClick={() => action?.()} fillWidth={true} disabled={!confirmButton.enabled}>
          {confirmButton.text}
        </FilledStylizedButton>
      </div>
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By withdrawing, you agree to our{' '}
        <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </Modal>
  );
}
