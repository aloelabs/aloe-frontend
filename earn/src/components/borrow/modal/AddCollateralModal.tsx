import { useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount } from 'wagmi';

import { MarginAccount, MarketInfo } from '../../../data/MarginAccount';
import { Token } from '../../../data/Token';
import { formatNumberInput, roundPercentage, truncateDecimals } from '../../../util/Numbers';
import TokenAmountSelectInput from '../../portfolio/TokenAmountSelectInput';

const SECONDARY_COLOR = '#CCDFED';

export type AddCollateralModalProps = {
  marginAccount: MarginAccount;
  marketInfo: MarketInfo;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function AddCollateralModal(props: AddCollateralModalProps) {
  const { marginAccount, marketInfo, isOpen, setIsOpen } = props;

  const [collateralAmount, setCollateralAmount] = useState('');
  const [collateralToken, setCollateralToken] = useState(marginAccount.token0);

  const { address: userAddress } = useAccount();

  const resetModal = () => {};

  const tokenOptions = useMemo(() => {
    return [marginAccount.token0, marginAccount.token1];
  }, [marginAccount.token0, marginAccount.token1]);

  const collateralTokenAPR = useMemo(() => {
    return (
      (collateralToken.address === marginAccount.token0.address ? marketInfo.borrowerAPR0 : marketInfo.borrowerAPR1) *
      100
    );
  }, [collateralToken.address, marginAccount.token0.address, marketInfo.borrowerAPR0, marketInfo.borrowerAPR1]);

  if (!userAddress || !isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      title='Add Collateral'
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
            Current Interest Rate
          </Text>
          <Text size='L' weight='bold' color={SECONDARY_COLOR}>
            {roundPercentage(collateralTokenAPR, 4)}% APR
          </Text>
        </div>
      </div>
    </Modal>
  );
}
