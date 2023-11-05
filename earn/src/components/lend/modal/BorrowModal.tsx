import { useContext, useMemo, useState } from 'react';

import { BigNumber } from 'ethers';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import { SquareInputWithMax } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_ORACLE_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { Q32 } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { formatNumberInput } from 'shared/lib/util/Numbers';
import { useContractRead } from 'wagmi';

import { ChainContext } from '../../../App';
import { ALOE_II_LIQUIDATION_INCENTIVE, ALOE_II_MAX_LEVERAGE } from '../../../data/constants/Values';
import { BorrowEntry, CollateralEntry } from '../BorrowingWidget';

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
  const { activeChain } = useContext(ChainContext);

  const selectedBorrow = selectedBorrows.find(
    (borrow) => borrow.collateral.address === selectedCollateral.asset.address
  );

  const selectedLendingPair = selectedCollateral.matchingPairs.find(
    (pair) =>
      pair.token0.address === selectedBorrow?.asset.address || pair.token1.address === selectedBorrow?.asset.address
  );

  const { data: consultData } = useContractRead({
    abi: volatilityOracleAbi,
    address: ALOE_II_ORACLE_ADDRESS[activeChain.id],
    args: [selectedLendingPair?.uniswapPool || '0x', Q32],
    functionName: 'consult',
    enabled: selectedLendingPair !== undefined,
  });

  const userBalance = GN.fromNumber(selectedCollateral.balance, selectedCollateral.asset.decimals);
  const collateralAmount = GN.fromDecimalString(collateralAmountStr || '0', selectedCollateral.asset.decimals);
  const borrowAmount = GN.fromDecimalString(borrowAmountStr || '0', selectedBorrow?.asset.decimals ?? 0);

  const maxBorrowAmount = useMemo(() => {
    if (consultData === undefined || selectedBorrow === undefined) {
      return null;
    }
    const sqrtPriceX96 = GN.fromBigNumber(consultData?.[1] ?? BigNumber.from('0'), 96, 2);
    const nSigma = selectedLendingPair?.nSigma ?? 0;
    const iv = consultData[2].div(1e6).toNumber() / 1e6;
    let ltv = 1 / ((1 + 1 / ALOE_II_MAX_LEVERAGE + 1 / ALOE_II_LIQUIDATION_INCENTIVE) * Math.exp(nSigma * iv));
    ltv = Math.max(0.1, Math.min(ltv, 0.9));

    let inTermsOfBorrow = collateralAmount;
    if (selectedLendingPair?.token0.address === selectedCollateral.asset.address) {
      inTermsOfBorrow = inTermsOfBorrow
        .mul(sqrtPriceX96)
        .mul(sqrtPriceX96)
        .setResolution(selectedBorrow.asset.decimals);
    } else {
      inTermsOfBorrow = inTermsOfBorrow
        .div(sqrtPriceX96)
        .div(sqrtPriceX96)
        .setResolution(selectedBorrow.asset.decimals);
    }
    const maxBorrowSupply = GN.fromNumber(selectedBorrow.supply, selectedBorrow.asset.decimals);
    const maxPotentialBorrow = inTermsOfBorrow.recklessMul(ltv);
    return GN.min(maxPotentialBorrow, maxBorrowSupply).recklessMul(0.8);
  }, [
    consultData,
    selectedBorrow,
    selectedLendingPair?.nSigma,
    selectedLendingPair?.token0.address,
    collateralAmount,
    selectedCollateral.asset.address,
  ]);

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
          <div>
            <Text size='M' className='mb-2'>
              {selectedBorrow.asset.symbol}
            </Text>
            <SquareInputWithMax
              size='L'
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const output = formatNumberInput(event.target.value);
                if (output != null) {
                  setBorrowAmountStr(output);
                }
              }}
              value={borrowAmountStr}
              onMaxClick={() => {
                if (maxBorrowAmount) {
                  setBorrowAmountStr(maxBorrowAmount.toString(GNFormat.DECIMAL));
                }
              }}
              maxDisabled={maxBorrowAmount === null || borrowAmount.eq(maxBorrowAmount)}
              maxButtonText='80% Max'
              placeholder='0.00'
              fullWidth={true}
              inputClassName={borrowAmountStr !== '' ? 'active' : ''}
            />
          </div>
        </div>
        <FilledGradientButton size='M' fillWidth={true} disabled={!confirmButton.enabled}>
          {confirmButton.text}
        </FilledGradientButton>
      </div>
    </Modal>
  );
}
