import React from 'react';
import { FilledStylizedButton } from '../../common/Buttons';
import {
  CloseableModal,
  DashedDivider,
  HorizontalDivider,
  LABEL_TEXT_COLOR,
  VALUE_TEXT_COLOR,
} from '../../common/Modal';
import TokenBreakdown from '../../common/TokenBreakdown';
import { Text } from '../../common/Typography';
import { MODAL_BLACK_TEXT_COLOR } from '../../pool/PoolInteractionTabs';

export type ConfirmDepositModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function CreateMarginAccountModal(props: ConfirmDepositModalProps) {
  const { open, setOpen, onConfirm, onCancel } = props;
  return (
    <CloseableModal
      open={open}
      setOpen={setOpen}
      onClose={onCancel}
      title='Confirm Deposit'
    >
      <div className='flex justify-between items-center mb-4'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>Estimated Total</Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>hfek</Text>
      </div>
      <TokenBreakdown
        token0Ticker={'ABC'}
        token1Ticker={'EFG'}
        token0Estimate={'1243'}
        token1Estimate={'15455'}
      />
      <HorizontalDivider />
      <div className='flex flex-col gap-y-4 mb-8'>
        <div className='flex justify-between items-center'>
          <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>Pool Selected</Text>
          <DashedDivider />
          <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>abc</Text>
        </div>
        <div className='flex justify-between items-center'>
          <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>Estimated Shares</Text>
          <DashedDivider />
          <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>efg Shares</Text>
        </div>
        <div className='flex justify-between items-center'>
          <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>Max Slippage</Text>
          <DashedDivider />
          <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>10%</Text>
        </div>
        {/*Hidden for the time being*/}
        <div className='hidden flex justify-between items-center'>
          <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>Network fee</Text>
          <DashedDivider />
          <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>10%</Text>
        </div>
      </div>
      {/* <HorizontalDivider />
      <div className='flex justify-between items-center mb-8'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>Network Fees</Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>{networkFee} WETH</Text>
      </div> */}
      <FilledStylizedButton size='M' fillWidth={true} color={MODAL_BLACK_TEXT_COLOR} onClick={onConfirm}>
        Confirm Deposit
      </FilledStylizedButton>
    </CloseableModal>
  );
}
