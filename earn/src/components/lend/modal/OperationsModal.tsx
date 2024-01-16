import { useContext } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BORROWER_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN } from 'shared/lib/data/GoodNumber';
import { useAccount, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import BorrowingOperation from '../../../data/operations/BorrowingOperation';
import MulticallOperation from '../../../data/operations/MulticallOperation';

export type OperationsModalProps = {
  chainOperations: MulticallOperation[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function OperationsModal(props: OperationsModalProps) {
  const { chainOperations, isOpen, setIsOpen, setPendingTxn } = props;

  const { address: userAddress } = useAccount();
  const { activeChain } = useContext(ChainContext);

  const combinedAnte = chainOperations.reduce((acc, chainOperation) => {
    const ante = chainOperation instanceof BorrowingOperation ? chainOperation.ante : GN.zero(18);
    return acc.add(ante ?? GN.zero(18));
  }, GN.zero(18));

  const {
    config: configMulticallOps,
    isError: isUnableToMulticallOps,
    isLoading: isCheckingIfAbleToMulticallOps,
  } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'multicall',
    args: [chainOperations.map((chainOperation) => chainOperation.data).flatMap((data) => data)],
    overrides: { value: combinedAnte.toBigNumber() },
    chainId: activeChain.id,
    enabled: userAddress !== undefined,
  });
  const gasLimit = configMulticallOps.request?.gasLimit.mul(110).div(100);
  const { write: call, isLoading: isAskingUserToMulticallOps } = useContractWrite({
    ...configMulticallOps,
    request: {
      ...configMulticallOps.request,
      gasLimit,
    },
    onSuccess(data) {
      setIsOpen(false);
      setPendingTxn(data);
    },
  });

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Operations'>
      {chainOperations.map((chainOperation, index) => {
        return (
          <div key={index}>
            <Text size='M'>Operation {index + 1}</Text>
          </div>
        );
      })}
      <FilledStylizedButton
        size='M'
        fillWidth={true}
        onClick={() => {
          call?.();
        }}
      >
        Confirm
      </FilledStylizedButton>
    </Modal>
  );
}
