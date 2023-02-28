import { Fragment, useEffect, useState } from 'react';

// import { Tab } from '@headlessui/react';
import { SendTransactionResult } from '@wagmi/core';
import { FilledGradientButton, FilledGreyButtonWithIcon } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
// import styled from 'styled-components';

import { ReactComponent as BackArrow } from '../../../assets/svg/back_arrow.svg';
import { MarginAccount, MarketInfo } from '../../../data/MarginAccount';
import { UniswapNFTPosition } from '../../../data/Uniswap';
import { AddCollateralTab } from './tab/AddCollateralTab';
import { AddUniswapNFTAsCollateralTab } from './tab/AddUniswapNFTAsCollateralTab';

enum AddCollateralModalState {
  SELECT_COLLATERAL_TYPE = 'SELECT_COLLATERAL_TYPE',
  TOKENS = 'TOKENS',
  UNISWAP_NFTS = 'UNISWAP_NFTS',
}

// const TabsWrapper = styled.div`
//   width: 100%;
//   display: flex;
//   flex-direction: row;
//   padding: 4px;
//   border-radius: 8px;
//   border: 1px solid rgba(26, 41, 52, 1);
// `;

// const TabButton = styled.button`
//   width: 100%;
//   padding: 8px;
//   border-radius: 8px;
//   background-color: transparent;
//   &.selected {
//     background-color: rgba(26, 41, 52);
//   }
// `;

export enum CollateralType {
  NORMAL = 'NORMAL',
  UNISWAP_NFT = 'UNISWAP_NFT',
}

export function getCollateralTypeValue(type: CollateralType): string {
  switch (type) {
    case CollateralType.NORMAL:
      return 'Normal';
    case CollateralType.UNISWAP_NFT:
      return 'Uniswap NFT';
    default:
      return '';
  }
}

export type AddCollateralModalProps = {
  marginAccount: MarginAccount;
  marketInfo: MarketInfo;
  uniswapNFTPositions: Map<number, UniswapNFTPosition>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function AddCollateralModal(props: AddCollateralModalProps) {
  const { marginAccount, uniswapNFTPositions, isOpen, setIsOpen, setPendingTxn } = props;
  // const [collateralType, setCollateralType] = useState(CollateralType.NORMAL);
  const [modalState, setModalState] = useState(() => {
    if (uniswapNFTPositions.size > 0) {
      return AddCollateralModalState.SELECT_COLLATERAL_TYPE;
    }
    return AddCollateralModalState.TOKENS;
  });

  useEffect(() => {
    if (isOpen) {
      setModalState(() => {
        if (uniswapNFTPositions.size > 0) {
          return AddCollateralModalState.SELECT_COLLATERAL_TYPE;
        }
        return AddCollateralModalState.TOKENS;
      });
    }
  }, [isOpen, uniswapNFTPositions.size]);

  const collateralTypes = [CollateralType.NORMAL];
  if (uniswapNFTPositions.size > 0) {
    collateralTypes.push(CollateralType.UNISWAP_NFT);
  }

  const hasMultipleTypesOfCollateral = uniswapNFTPositions.size > 0;

  const defaultUniswapNFTPosition = uniswapNFTPositions.size > 0 ? Array.from(uniswapNFTPositions.entries())[0] : null;

  return (
    <Modal isOpen={isOpen} title='Add Collateral' setIsOpen={setIsOpen} maxHeight='650px' maxWidth='500px'>
      {hasMultipleTypesOfCollateral && modalState !== AddCollateralModalState.SELECT_COLLATERAL_TYPE && (
        <div className='flex justify-start w-full'>
          <FilledGreyButtonWithIcon
            size='S'
            Icon={<BackArrow />}
            svgColorType='stroke'
            position='leading'
            onClick={() => {
              setModalState(AddCollateralModalState.SELECT_COLLATERAL_TYPE);
            }}
          >
            Back
          </FilledGreyButtonWithIcon>
        </div>
      )}
      {modalState === AddCollateralModalState.SELECT_COLLATERAL_TYPE && (
        <div className='flex flex-col gap-4'>
          <Text size='L'>What type of collateral would you like to add?</Text>
          <div className='flex flex-col gap-4'>
            <FilledGradientButton
              size='M'
              fillWidth={true}
              onClick={() => setModalState(AddCollateralModalState.TOKENS)}
            >
              Tokens
            </FilledGradientButton>
            <FilledGradientButton
              size='M'
              fillWidth={true}
              onClick={() => setModalState(AddCollateralModalState.UNISWAP_NFTS)}
            >
              Uniswap NFTs
            </FilledGradientButton>
          </div>
        </div>
      )}
      {modalState === AddCollateralModalState.TOKENS && (
        <>
          <AddCollateralTab marginAccount={marginAccount} setPendingTxn={setPendingTxn} setIsOpen={setIsOpen} />
        </>
      )}
      {modalState === AddCollateralModalState.UNISWAP_NFTS && defaultUniswapNFTPosition != null && (
        <AddUniswapNFTAsCollateralTab
          marginAccount={marginAccount}
          uniswapNFTPositions={uniswapNFTPositions}
          defaultUniswapNFTPosition={defaultUniswapNFTPosition}
          setPendingTxn={setPendingTxn}
          setIsOpen={setIsOpen}
        />
      )}
      {/* <Tab.Group>
        <Tab.List className='w-full flex rounded-md mb-6'>
          <TabsWrapper>
            {collateralTypes.map((type: string, index: number) => (
              <Tab as={Fragment} key={index}>
                {({ selected }) => (
                  <TabButton
                    className={selected ? 'selected' : ''}
                    onClick={() => setCollateralType(type as CollateralType)}
                  >
                    <Text size='M' weight='bold' color='rgb(255, 255, 255)'>
                      {getCollateralTypeValue(type as CollateralType)}
                    </Text>
                  </TabButton>
                )}
              </Tab>
            ))}
          </TabsWrapper>
        </Tab.List>
        <Tab.Panels as={Fragment}>
          <Tab.Panel className='w-full px-2'>
            <AddCollateralTab marginAccount={marginAccount} setPendingTxn={setPendingTxn} setIsOpen={setIsOpen} />
          </Tab.Panel>
          <Tab.Panel className='w-full px-2'>
            {defaultUniswapNFTPosition !== null && (
              <AddUniswapNFTAsCollateralTab
                marginAccount={marginAccount}
                uniswapNFTPositions={uniswapNFTPositions}
                defaultUniswapNFTPosition={defaultUniswapNFTPosition}
                setPendingTxn={setPendingTxn}
                setIsOpen={setIsOpen}
              />
            )}
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group> */}
    </Modal>
  );
}
