import { useState } from 'react';

import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import Modal, { LABEL_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import { MODAL_BLACK_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';

const TERTIARY_COLOR = '#4b6980';

export type CreateMarginAccountModalProps = {
  isOpen: boolean;
  isTxnPending: boolean;
  availablePools: DropdownOption<string>[];
  defaultPool: DropdownOption<string>;
  setIsOpen: (open: boolean) => void;
  onConfirm: (selectedPool: string | null) => void;
};

export default function CreateMarginAccountModal(props: CreateMarginAccountModalProps) {
  const { isOpen, isTxnPending, availablePools, defaultPool, setIsOpen, onConfirm } = props;
  const [selectedPool, setSelectedPool] = useState<DropdownOption<string>>(defaultPool);
  const confirmButtonText = isTxnPending ? 'Pending' : 'Create Borrow Vault';
  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='New Borrow Vault'>
      <div className='flex flex-row items-center w-full justify-between mb-8'>
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
          const selectedPoolValue = selectedPool.value;
          if (selectedPoolValue) {
            onConfirm(selectedPoolValue);
          }
        }}
        disabled={isTxnPending}
      >
        {confirmButtonText}
      </FilledStylizedButton>
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By creating a Borrow Vault, you agree to our{' '}
        <a href={TERMS_OF_SERVICE_URL} rel='noreferrer' target='_blank' className='underline'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </Modal>
  );
}
