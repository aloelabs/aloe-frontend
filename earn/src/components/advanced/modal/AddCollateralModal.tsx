import { useEffect, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { UniswapNFTPosition } from 'shared/lib/data/Uniswap';

import { AddCollateralTab } from './tab/AddCollateralTab';
import { AddUniswapNFTAsCollateralTab } from './tab/AddUniswapNFTAsCollateralTab';
import { BorrowerNftBorrower } from '../../../hooks/useDeprecatedMarginAccountShim';

const SECONDARY_COLOR = '#CCDFED';

enum AddCollateralModalState {
  SELECT_COLLATERAL_TYPE = 'SELECT_COLLATERAL_TYPE',
  TOKENS = 'TOKENS',
  UNISWAP_NFTS = 'UNISWAP_NFTS',
}

export type AddCollateralModalProps = {
  borrower: BorrowerNftBorrower;
  uniswapNFTPositions: Map<number, UniswapNFTPosition>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function AddCollateralModal(props: AddCollateralModalProps) {
  const { borrower, uniswapNFTPositions, isOpen, setIsOpen, setPendingTxn } = props;

  const [modalState, setModalState] = useState(() => {
    // Only show the select collateral type modal if there are uniswap NFT positions and the user has not already
    // added the maximum number of uniswap positions.
    if (uniswapNFTPositions.size > 0 && borrower.assets.uniswapPositions.length < 3) {
      return AddCollateralModalState.SELECT_COLLATERAL_TYPE;
    }
    return AddCollateralModalState.TOKENS;
  });

  useEffect(() => {
    if (isOpen) {
      setModalState(() => {
        // Only show the select collateral type modal if there are uniswap NFT positions and the user has not already
        // added the maximum number of uniswap positions.
        if (uniswapNFTPositions.size > 0 && borrower.assets.uniswapPositions.length < 3) {
          return AddCollateralModalState.SELECT_COLLATERAL_TYPE;
        }
        return AddCollateralModalState.TOKENS;
      });
    }
  }, [borrower.assets.uniswapPositions, isOpen, uniswapNFTPositions.size]);

  const defaultUniswapNFTPosition = uniswapNFTPositions.size > 0 ? Array.from(uniswapNFTPositions.entries())[0] : null;

  return (
    <Modal isOpen={isOpen} title='Add Collateral' setIsOpen={setIsOpen} maxHeight='650px' maxWidth='500px'>
      {modalState === AddCollateralModalState.SELECT_COLLATERAL_TYPE && (
        <div className='flex flex-col gap-4'>
          <Text size='M' color={SECONDARY_COLOR}>
            What type of collateral would you like to add?
          </Text>
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
              Uniswap NFT
            </FilledGradientButton>
          </div>
        </div>
      )}
      {modalState === AddCollateralModalState.TOKENS && (
        <AddCollateralTab
          marginAccount={borrower}
          isOpen={isOpen}
          setPendingTxn={setPendingTxn}
          setIsOpen={setIsOpen}
        />
      )}
      {modalState === AddCollateralModalState.UNISWAP_NFTS && defaultUniswapNFTPosition != null && (
        <AddUniswapNFTAsCollateralTab
          borrower={borrower}
          existingUniswapPositions={borrower.assets.uniswapPositions}
          uniswapNFTPositions={uniswapNFTPositions}
          defaultUniswapNFTPosition={defaultUniswapNFTPosition}
          setPendingTxn={setPendingTxn}
          setIsOpen={setIsOpen}
        />
      )}
    </Modal>
  );
}
