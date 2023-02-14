import { useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import Big from 'big.js';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount } from 'wagmi';

import { MarginAccount, MarketInfo } from '../../../data/MarginAccount';
import { Token } from '../../../data/Token';
import { formatNumberInput, truncateDecimals } from '../../../util/Numbers';
import TokenAmountSelectInput from '../../portfolio/TokenAmountSelectInput';

const SECONDARY_COLOR = '#CCDFED';

export type RemoveCollateralModalProps = {
  marginAccount: MarginAccount;
  marketInfo: MarketInfo;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function RemoveCollateralModal(props: RemoveCollateralModalProps) {
  const { marginAccount, isOpen, setIsOpen } = props;

  const [collateralAmount, setCollateralAmount] = useState('');
  const [collateralToken, setCollateralToken] = useState(marginAccount.token0);

  const { address: userAddress } = useAccount();

  const resetModal = () => {};

  const tokenOptions = useMemo(() => {
    return [marginAccount.token0, marginAccount.token1];
  }, [marginAccount.token0, marginAccount.token1]);

  const existingCollateral =
    collateralToken.address === marginAccount.token0.address
      ? marginAccount.assets.token0Raw
      : marginAccount.assets.token1Raw;

  const numericCollateralAmount = Number(collateralAmount) || 0;

  const existingCollateralBig = useMemo(
    () => new Big(existingCollateral).mul(10 ** collateralToken.decimals),
    [collateralToken.decimals, existingCollateral]
  );
  const numericCollateralAmountBig = useMemo(
    () => new Big(numericCollateralAmount).mul(10 ** collateralToken.decimals),
    [collateralToken.decimals, numericCollateralAmount]
  );

  const newCollateralAmount = Math.max(
    existingCollateralBig
      .sub(numericCollateralAmountBig)
      .div(10 ** collateralToken.decimals)
      .toNumber(),
    0
  );

  if (!userAddress || !isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      title='Remove Collateral'
      setIsOpen={(open: boolean) => {
        setIsOpen(open);
        if (!open) {
          resetModal();
        }
      }}
      maxHeight='650px'
    >
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Collateral Amount
          </Text>
          <TokenAmountSelectInput
            inputValue={collateralAmount}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, collateralToken.decimals);
                setCollateralAmount(truncatedOutput);
              }
            }}
            onSelect={(option: Token) => {
              setCollateralAmount('');
              setCollateralToken(option);
            }}
            options={tokenOptions}
            selectedOption={collateralToken}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're removing{' '}
            <strong>
              {collateralAmount || '0.00'} {collateralToken.ticker}
            </strong>{' '}
            collateral from the{' '}
            <strong>
              {marginAccount.token0.ticker}/{marginAccount.token1.ticker}
            </strong>{' '}
            pair. Your total collateral for this token in this pair will be{' '}
            <strong>
              {truncateDecimals(newCollateralAmount.toString(), collateralToken.decimals)} {collateralToken.ticker}
            </strong>
            .
          </Text>
        </div>
      </div>
    </Modal>
  );
}
