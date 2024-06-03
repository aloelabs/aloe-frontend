import { type WriteContractReturnType } from '@wagmi/core';
import Modal from 'shared/lib/components/common/Modal';
import { UniswapNFTPosition, UniswapPosition } from 'shared/lib/data/Uniswap';

import { AddUniswapNFTAsCollateralTab } from './tab/AddUniswapNFTAsCollateralTab';
import { BorrowerNftBorrower } from '../../../data/hooks/useDeprecatedMarginAccountShim';

export type ImportUniswapNFTModalProps = {
  isOpen: boolean;
  borrower: BorrowerNftBorrower;
  existingUniswapPositions: readonly UniswapPosition[];
  uniswapNFTPositions: Map<number, UniswapNFTPosition>;
  defaultUniswapNFTPosition: [number, UniswapNFTPosition];
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function ImportUniswapNFTModal(props: ImportUniswapNFTModalProps) {
  const { isOpen, setIsOpen } = props;
  return (
    <Modal isOpen={isOpen} title='Import Uniswap NFT Position' setIsOpen={setIsOpen} maxHeight='650px' maxWidth='500px'>
      <AddUniswapNFTAsCollateralTab {...props} />
    </Modal>
  );
}
