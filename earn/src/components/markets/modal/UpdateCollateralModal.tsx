import { Fragment, useState } from 'react';

import { Tab } from '@headlessui/react';
import { type WriteContractReturnType } from '@wagmi/core';
import { BigNumber } from 'ethers';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import styled from 'styled-components';

import { BorrowerNftBorrower } from '../../../data/BorrowerNft';
import { UniswapNFTPosition } from '../../../data/Uniswap';
import AddCollateralModalContent from './content/AddCollateralModalContent';
import RemoveCollateralModalContent from './content/RemoveCollateralModalContent';
import ToUniswapNFTModalContent from './content/ToUniswapNFTModalContent';

export enum ConfirmationType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
}

export function getConfirmationTypeValue(type: ConfirmationType): string {
  switch (type) {
    case ConfirmationType.DEPOSIT:
      return 'Deposit';
    case ConfirmationType.WITHDRAW:
      return 'Withdraw';
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

export type UpdateCollateralModalProps = {
  isOpen: boolean;
  borrower: BorrowerNftBorrower;
  uniswapPositions: UniswapNFTPosition[];
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function UpdateCollateralModal(props: UpdateCollateralModalProps) {
  const { isOpen, borrower, uniswapPositions, setIsOpen, setPendingTxn } = props;
  const [confirmationType, setConfirmationType] = useState<ConfirmationType>(ConfirmationType.DEPOSIT);

  if (borrower.assets.uniswapPositions.length > 0) {
    const positionToWithdraw = borrower.assets.uniswapPositions[0];
    const uniswapNftId = uniswapPositions.find(
      (nft) => nft.lower === positionToWithdraw.lower && nft.upper === positionToWithdraw.upper
    )?.tokenId;

    if (uniswapNftId === undefined) return null;

    return (
      <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Withdraw Uniswap NFT'>
        <div className='w-full flex flex-col gap-4'>
          <ToUniswapNFTModalContent
            borrower={borrower}
            positionToWithdraw={positionToWithdraw}
            uniswapNftId={BigNumber.from(uniswapNftId)}
            setIsOpen={setIsOpen}
            setPendingTxnResult={setPendingTxn}
          />
        </div>
      </Modal>
    );
  }

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
              <AddCollateralModalContent
                borrower={borrower}
                setIsOpen={setIsOpen}
                setPendingTxnResult={setPendingTxn}
              />
            </Tab.Panel>
            <Tab.Panel className='w-full px-2'>
              <RemoveCollateralModalContent
                borrower={borrower}
                setIsOpen={setIsOpen}
                setPendingTxnResult={setPendingTxn}
              />
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </Modal>
  );
}
