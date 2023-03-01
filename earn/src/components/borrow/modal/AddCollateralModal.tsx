import { useEffect, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';

import { MAX_UNISWAP_POSITIONS } from '../../../data/constants/Values';
import { MarginAccount, MarketInfo } from '../../../data/MarginAccount';
import { UniswapNFTPosition, UniswapPosition } from '../../../data/Uniswap';
import { AddCollateralTab } from './tab/AddCollateralTab';
import { AddUniswapNFTAsCollateralTab } from './tab/AddUniswapNFTAsCollateralTab';

const SECONDARY_COLOR = '#CCDFED';

enum AddCollateralModalState {
  SELECT_COLLATERAL_TYPE = 'SELECT_COLLATERAL_TYPE',
  TOKENS = 'TOKENS',
  UNISWAP_NFTS = 'UNISWAP_NFTS',
}

export type AddCollateralModalProps = {
  marginAccount: MarginAccount;
  marketInfo: MarketInfo;
  isLoadingUniswapPositions: boolean;
  existingUniswapPositions: readonly UniswapPosition[];
  uniswapNFTPositions: Map<number, UniswapNFTPosition>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function AddCollateralModal(props: AddCollateralModalProps) {
  const {
    marginAccount,
    isLoadingUniswapPositions,
    existingUniswapPositions,
    uniswapNFTPositions,
    isOpen,
    setIsOpen,
    setPendingTxn,
  } = props;
  const [modalState, setModalState] = useState(() => {
    // Only show the select collateral type modal if there are uniswap NFT positions and the user has not already
    // added the maximum number of uniswap positions.
    if (
      uniswapNFTPositions.size > 0 &&
      existingUniswapPositions.length < MAX_UNISWAP_POSITIONS &&
      !isLoadingUniswapPositions
    ) {
      return AddCollateralModalState.SELECT_COLLATERAL_TYPE;
    }
    return AddCollateralModalState.TOKENS;
  });

  useEffect(() => {
    if (isOpen) {
      setModalState(() => {
        // Only show the select collateral type modal if there are uniswap NFT positions and the user has not already
        // added the maximum number of uniswap positions.
        if (
          uniswapNFTPositions.size > 0 &&
          existingUniswapPositions.length < MAX_UNISWAP_POSITIONS &&
          !isLoadingUniswapPositions
        ) {
          return AddCollateralModalState.SELECT_COLLATERAL_TYPE;
        }
        return AddCollateralModalState.TOKENS;
      });
    }
  }, [existingUniswapPositions.length, isLoadingUniswapPositions, isOpen, uniswapNFTPositions.size]);

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
          marginAccount={marginAccount}
          isOpen={isOpen}
          setPendingTxn={setPendingTxn}
          setIsOpen={setIsOpen}
        />
      )}
      {modalState === AddCollateralModalState.UNISWAP_NFTS && defaultUniswapNFTPosition != null && (
        <AddUniswapNFTAsCollateralTab
          marginAccount={marginAccount}
          existingUniswapPositions={existingUniswapPositions}
          uniswapNFTPositions={uniswapNFTPositions}
          defaultUniswapNFTPosition={defaultUniswapNFTPosition}
          setPendingTxn={setPendingTxn}
          setIsOpen={setIsOpen}
        />
      )}
    </Modal>
  );
}
