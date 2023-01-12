import { useState } from 'react';

import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import Modal, { LABEL_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';

import { MODAL_BLACK_TEXT_COLOR } from '../../common/Modal';

const TERTIARY_COLOR = '#4b6980';

export type CreateMarginAccountModalProps = {
  isOpen: boolean;
  isTxnPending: boolean;
  availablePools: DropdownOption<string>[];
  setIsOpen: (open: boolean) => void;
  onConfirm: (selectedPool: string | null) => void;
};

export default function CreateMarginAccountModal(props: CreateMarginAccountModalProps) {
  const { isOpen, isTxnPending, availablePools, setIsOpen, onConfirm } = props;
  const [selectedPool, setSelectedPool] = useState<DropdownOption<string> | null>(
    availablePools.length > 0 ? availablePools[0] : null
  );
  if (selectedPool == null) {
    return null;
  }
  const confirmButtonText = isTxnPending ? 'Pending' : 'Create Margin Account';
  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='New Margin Account'>
      <div className='flex flex-col gap-3 mb-8 w-full'>
        <Text size='M' weight='bold' color={LABEL_TEXT_COLOR}>
          Uniswap Pool
        </Text>
        <Dropdown
          options={availablePools}
          selectedOption={selectedPool ?? availablePools[0]}
          onSelect={(option: DropdownOption<string>) => {
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
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By creating a margin account, you agree to our{' '}
        <a href='/prime/public/terms.pdf' rel='noreferrer' target='_blank' className='underline'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </Modal>
  );
}
