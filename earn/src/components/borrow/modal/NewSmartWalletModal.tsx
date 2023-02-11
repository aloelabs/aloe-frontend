import { useState } from 'react';

import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';

export type NewSmartWalletModalProps = {
  availablePoolOptions: DropdownOption<string>[];
  defaultOption: DropdownOption<string>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

export default function NewSmartWalletModal(props: NewSmartWalletModalProps) {
  const { availablePoolOptions, defaultOption, isOpen, setIsOpen } = props;

  const [selectedPoolOption, setSelectedPoolOption] = useState<DropdownOption<string>>(defaultOption);

  const resetModal = () => {
    // ...
  };

  return (
    <Modal
      isOpen={isOpen}
      title='Create a new smart wallet'
      setIsOpen={(open: boolean) => {
        setIsOpen(open);
        if (!open) {
          resetModal();
        }
      }}
      maxHeight='650px'
    >
      <div className='w-full'>
        <div className='flex flex-col gap-4'>
          <Text size='M' weight='medium'>
            Select a pool to borrow from
          </Text>
          <Dropdown
            options={availablePoolOptions}
            onSelect={(option: DropdownOption<string>) => {
              setSelectedPoolOption(option);
            }}
            selectedOption={selectedPoolOption}
          />
        </div>
        <FilledStylizedButton size='M' fillWidth={true} onClick={() => {}} className='mt-16'>
          Create
        </FilledStylizedButton>
      </div>
    </Modal>
  );
}
