import { useEffect, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';

import { MarginAccount, MarketInfo } from '../../../data/MarginAccount';
import { UniswapNFTPosition } from '../../../data/Uniswap';
import { AddCollateralTab } from './tab/AddCollateralTab';
import { AddUniswapNFTAsCollateralTab } from './tab/AddUniswapNFTAsCollateralTab';

enum AddCollateralModalState {
  SELECT_COLLATERAL_TYPE = 'SELECT_COLLATERAL_TYPE',
  TOKENS = 'TOKENS',
  UNISWAP_NFTS = 'UNISWAP_NFTS',
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

  const defaultUniswapNFTPosition = uniswapNFTPositions.size > 0 ? Array.from(uniswapNFTPositions.entries())[0] : null;

  return (
    <Modal isOpen={isOpen} title='Add Collateral' setIsOpen={setIsOpen} maxHeight='650px' maxWidth='500px'>
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
    </Modal>
  );
}
