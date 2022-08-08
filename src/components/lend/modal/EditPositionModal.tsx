import React from 'react';
import { FilledStylizedButton } from '../../common/Buttons';
import {
  CloseableModal,
  DashedDivider,
  HorizontalDivider,
  LABEL_TEXT_COLOR,
  VALUE_TEXT_COLOR,
} from '../../common/Modal';
import { Text } from '../../common/Typography';
import { MODAL_BLACK_TEXT_COLOR } from '../../pool/PoolInteractionTabs';

export type EditPositionModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function EditPositionModal(props: EditPositionModalProps) {
  const {
    open,
    setOpen,
    onConfirm,
    onCancel,
  } = props;
  return (
    <CloseableModal
      open={open}
      setOpen={setOpen}
      onClose={onCancel}
      title='Edit Position'
    >
      <div className='flex justify-between items-center mb-4'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
          Estimated Total
        </Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
          {/* {estimatedTotal} */}
        </Text>
      </div>
      {/* <TokenBreakdown
        token0Ticker={token0Ticker}
        token1Ticker={token1Ticker}
        token0Estimate={token0Estimate}
        token1Estimate={token1Estimate}
      /> */}
      <HorizontalDivider />
      <div className='flex flex-col gap-y-4 mb-8'>
        <div className='flex justify-between items-center'>
          <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
            Pool Selected
          </Text>
          <DashedDivider />
          <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
            {/* {token0Ticker} - {token1Ticker} */}
          </Text>
        </div>
        <div className='flex justify-between items-center'>
          <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
            Estimated Shares
          </Text>
          <DashedDivider />
          <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
            {/* {numberOfShares} Shares */}
          </Text>
        </div>
        <div className='flex justify-between items-center'>
          <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
            Max Slippage
          </Text>
          <DashedDivider />
          <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
            {/* {maxSlippage}% */}
          </Text>
        </div>
        {/*Hidden for the time being*/}
        <div className='hidden flex justify-between items-center'>
          <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
            Network fee
          </Text>
          <DashedDivider />
          <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
            {/* {networkFee}% */}
          </Text>
        </div>
      </div>
      {/* <HorizontalDivider />
      <div className='flex justify-between items-center mb-8'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>Network Fees</Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>{networkFee} WETH</Text>
      </div> */}
      <FilledStylizedButton
        size='M'
        fillWidth={true}
        color={MODAL_BLACK_TEXT_COLOR}
        onClick={onConfirm}
      >
        Confirm Deposit
      </FilledStylizedButton>
    </CloseableModal>
  );
}
