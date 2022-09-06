import { useState } from 'react';
import { FilledStylizedButton } from '../../common/Buttons';
import { Dropdown } from '../../common/Dropdown';
import {
  CloseableModal,
  DashedDivider,
  LABEL_TEXT_COLOR,
} from '../../common/Modal';
import { Text } from '../../common/Typography';
import { MODAL_BLACK_TEXT_COLOR } from '../../pool/PoolInteractionTabs';

export type CreateMarginAccountModalProps = {
  open: boolean;
  availablePools: {label: string, value: string}[];
  setOpen: (open: boolean) => void;
  onConfirm: (selectedPool: string | null) => void;
  onCancel: () => void;
};

export default function CreateMarginAccountModal(props: CreateMarginAccountModalProps) {
  const [selectedPool, setSelectedPool] = useState<string | null>(null);

  const { open, setOpen, onConfirm, onCancel, availablePools } = props;
  return (
    <CloseableModal
      open={open}
      setOpen={setOpen}
      onClose={onCancel}
      title='New'
    >
      <div className='flex justify-between items-center mb-8'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>Uniswap Pool</Text>
        <DashedDivider />
        <Dropdown
          options={availablePools}
          selectedOption={availablePools[0]}
          onSelect={(option) => {
            setSelectedPool(option.value);
          }}
          small={true}
        />
      </div>
      <FilledStylizedButton size='M' fillWidth={true} color={MODAL_BLACK_TEXT_COLOR} onClick={() => {
        onConfirm(selectedPool);
      }}>
        Create Margin Account
      </FilledStylizedButton>
    </CloseableModal>
  );
}
