import { useState } from 'react';

import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { formatNumberInput } from 'shared/lib/util/Numbers';

import { BorrowEntry, CollateralEntry } from '../BorrowingWidget';

// const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

enum ConfirmButtonState {
  WAITING_FOR_USER,
  READY,
  LOADING,
  INSUFFICIENT_ASSET,
  DISABLED,
}

function getConfirmButton(state: ConfirmButtonState): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading', enabled: false };
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return { text: 'Insufficient Asset', enabled: false };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

export type BorrowModalProps = {
  isOpen: boolean;
  selectedBorrows: BorrowEntry[];
  selectedCollateral: CollateralEntry;
  setIsOpen: (isOpen: boolean) => void;
};

export default function BorrowModal(props: BorrowModalProps) {
  const { isOpen, selectedBorrows, selectedCollateral, setIsOpen } = props;
  const [collateralAmountStr, setCollateralAmountStr] = useState<string>('');
  const [borrowAmountStr, setBorrowAmountStr] = useState<string>('');
  // const { activeChain } = useContext(ChainContext);
  // const { address: userAddress } = useAccount();

  const selectedBorrow = selectedBorrows.find(
    (borrow) => borrow.collateral.address === selectedCollateral.asset.address
  );

  // const selectedLendingPair = selectedCollateral.matchingPairs.find(
  //   (pair) =>
  //     pair.token0.address === selectedBorrow?.asset.address || pair.token1.address === selectedBorrow?.asset.address
  // );

  // const { data: consultData } = useContractRead({
  //   abi: volatilityOracleAbi,
  //   address: ALOE_II_ORACLE_ADDRESS[activeChain.id],
  //   args: [selectedLendingPair?.uniswapPool || '0x', Q32],
  //   functionName: 'consult',
  //   enabled: selectedLendingPair !== undefined,
  // });

  const userBalance = GN.fromNumber(selectedCollateral.balance, selectedCollateral.asset.decimals);
  const collateralAmount = GN.fromDecimalString(collateralAmountStr || '0', selectedCollateral.asset.decimals);

  let confirmButtonState: ConfirmButtonState;
  if (collateralAmount.gt(userBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (collateralAmountStr === '') {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else {
    confirmButtonState = ConfirmButtonState.READY;
  }

  const confirmButton = getConfirmButton(confirmButtonState);

  if (!selectedBorrow) return null;

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Borrow'>
      <div className='w-full flex flex-col gap-4'>
        <div>
          <Text size='M' weight='bold'>
            Collateral
          </Text>
          <TokenAmountInput
            token={selectedCollateral.asset}
            value={collateralAmountStr}
            max={userBalance.toString(GNFormat.DECIMAL)}
            maxed={collateralAmount.eq(userBalance)}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                setCollateralAmountStr(output);
              }
            }}
          />
        </div>
        <div>
          <Text size='M' weight='bold'>
            Borrow
          </Text>
          <TokenAmountInput
            token={selectedBorrow.asset}
            value={borrowAmountStr}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                setBorrowAmountStr(output);
              }
            }}
          />
          <FilledGradientButton size='M' fillWidth={true} disabled={!confirmButton.enabled}>
            {confirmButton.text}
          </FilledGradientButton>
        </div>
      </div>
    </Modal>
  );
}
