import { useState } from 'react';

import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import { Text } from 'shared/lib/components/common/Typography';

import { CloseableModal, LABEL_TEXT_COLOR } from '../../common/Modal';
import { MODAL_BLACK_TEXT_COLOR } from '../../common/Modal';

export type CreateMarginAccountModalProps = {
  open: boolean;
  isTxnPending: boolean;
  availablePools: DropdownOption[];
  setOpen: (open: boolean) => void;
  onConfirm: (selectedPool: string | null) => void;
  onCancel: () => void;
};

export default function CreateMarginAccountModal(props: CreateMarginAccountModalProps) {
  const { open, isTxnPending, availablePools, setOpen, onConfirm, onCancel } = props;
  const [selectedPool, setSelectedPool] = useState<DropdownOption | null>(
    availablePools.length > 0 ? availablePools[0] : null,
  );
  if (selectedPool == null) {
    return null;
  }
  const confirmButtonText = isTxnPending ? 'Pending' : 'Create Margin Account';
  return (
    <CloseableModal open={open} setOpen={setOpen} onClose={onCancel} title='New Margin Account'>
      <div className='flex flex-col gap-3 mb-8'>
        <Text size='M' weight='bold' color={LABEL_TEXT_COLOR}>
          Uniswap Pool
        </Text>
        <Dropdown
          options={availablePools}
          selectedOption={selectedPool ?? availablePools[0]}
          onSelect={(option) => {
            setSelectedPool(option);
          }}
        />
      </div>
      <FilledStylizedButton
        size='M'
        fillWidth={true}
        color={MODAL_BLACK_TEXT_COLOR}
        onClick={() => {
          const selectedPoolValue = selectedPool?.value;
          if (selectedPoolValue) {
            onConfirm(selectedPoolValue);
          }
        }}
        disabled={isTxnPending}
      >
        {confirmButtonText}
      </FilledStylizedButton>
    </CloseableModal>
  );
}
