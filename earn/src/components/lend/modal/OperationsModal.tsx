import { useContext, useMemo } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { ethers } from 'ethers';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BORROWER_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { useAccount, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import MulticallOperator from '../../../data/operations/MulticallOperator';

export type OperationsModalProps = {
  multicallOperator: MulticallOperator;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function OperationsModal(props: OperationsModalProps) {
  const { multicallOperator, isOpen, setIsOpen, setPendingTxn } = props;

  const { address: userAddress } = useAccount();
  const { activeChain } = useContext(ChainContext);

  const mintOperation = multicallOperator.combineMintOperations();
  const modifyOperation = multicallOperator.combineModifyOperations();
  const combinedAnte = multicallOperator.getCombinedAnte();

  const borrowerNft = useMemo(() => new ethers.utils.Interface(borrowerNftAbi), []);
  const encodedMint =
    mintOperation &&
    (borrowerNft.encodeFunctionData('mint', [
      mintOperation.to,
      mintOperation.pools,
      mintOperation.salts,
    ]) as `0x${string}`);

  const encodedModify =
    modifyOperation &&
    (borrowerNft.encodeFunctionData('modify', [
      modifyOperation.owner,
      modifyOperation.indices,
      modifyOperation.managers,
      modifyOperation.data,
      modifyOperation.antes.map((ante) => ante.toBigNumber().div(1e13)),
    ]) as `0x${string}`);

  const functionName = mintOperation ? 'multicall' : 'modify';

  const args = mintOperation
    ? [[encodedMint ?? '0x', encodedModify]]
    : [
        modifyOperation.owner,
        modifyOperation.indices,
        modifyOperation.managers,
        modifyOperation.data,
        modifyOperation.antes.map((ante) => ante.toBigNumber().div(1e13)),
      ];

  const {
    config: configMulticallOps,
    isError: isUnableToMulticallOps,
    isLoading: isCheckingIfAbleToMulticallOps,
  } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: functionName,
    args: args as any,
    overrides: {
      value: combinedAnte.toBigNumber(),
    },
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
      <div className='w-full flex flex-col gap-4'>
        <Text size='M'>
          You are performing {mintOperation?.salts.length ?? 0} mint operations and{' '}
          {modifyOperation?.indices.length ?? 0} modify operations in a single transaction. This will save you gas fees.
        </Text>
        <FilledStylizedButton
          size='M'
          fillWidth={true}
          onClick={() => {
            call?.();
          }}
          disabled={
            isAskingUserToMulticallOps || isCheckingIfAbleToMulticallOps || isUnableToMulticallOps || !userAddress
          }
        >
          Confirm
        </FilledStylizedButton>
      </div>
    </Modal>
  );
}
