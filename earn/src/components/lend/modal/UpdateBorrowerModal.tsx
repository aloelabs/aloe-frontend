import { Fragment, useState } from 'react';

import { Tab } from '@headlessui/react';
import { SendTransactionResult } from '@wagmi/core';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import styled from 'styled-components';

import { BorrowerNftBorrower } from '../../../data/BorrowerNft';
import { MarketInfo } from '../../../data/MarketInfo';
import BorrowModalContent from './content/BorrowModalContent';
import RepayModalContent from './content/RepayModalContent';

export enum ConfirmationType {
  BORROW = 'BORROW',
  REPAY = 'REPAY',
}

export function getConfirmationTypeValue(type: ConfirmationType): string {
  switch (type) {
    case ConfirmationType.BORROW:
      return 'Borrow';
    case ConfirmationType.REPAY:
      return 'Repay';
    default:
      return '';
  }
}

const TabsWrapper = styled.div`
  width: 100%;
  display: flex;
  flex-direction: row;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid ${GREY_700};
`;

const TabButton = styled.button`
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  background-color: transparent;
  &.selected {
    background-color: rgba(26, 41, 52);
  }
`;

export type UpdateBorrowerModalProps = {
  isOpen: boolean;
  borrower: BorrowerNftBorrower;
  marketInfo?: MarketInfo;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function UpdateBorrowerModal(props: UpdateBorrowerModalProps) {
  const { isOpen, borrower, marketInfo, setIsOpen, setPendingTxn } = props;
  const [confirmationType, setConfirmationType] = useState<ConfirmationType>(ConfirmationType.BORROW);

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title={getConfirmationTypeValue(confirmationType)}>
      <div className='w-full flex flex-col gap-4'>
        <Tab.Group>
          <Tab.List className='w-full flex rounded-md mb-6'>
            <TabsWrapper>
              {Object.keys(ConfirmationType).map((type: string, index: number) => (
                <Tab as={Fragment} key={index}>
                  {({ selected }) => (
                    <TabButton
                      className={selected ? 'selected' : ''}
                      onClick={() => setConfirmationType(type as ConfirmationType)}
                    >
                      <Text size='M' weight='bold' color='rgb(255, 255, 255)'>
                        {getConfirmationTypeValue(type as ConfirmationType)}
                      </Text>
                    </TabButton>
                  )}
                </Tab>
              ))}
            </TabsWrapper>
          </Tab.List>
          <Tab.Panels as={Fragment}>
            <Tab.Panel className='w-full px-2'>
              <BorrowModalContent
                borrower={borrower}
                setIsOpen={setIsOpen}
                marketInfo={marketInfo}
                setPendingTxnResult={setPendingTxn}
              />
            </Tab.Panel>
            <Tab.Panel className='w-full px-2'>
              <RepayModalContent borrower={borrower} setIsOpen={setIsOpen} setPendingTxnResult={setPendingTxn} />
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </Modal>
  );
}
