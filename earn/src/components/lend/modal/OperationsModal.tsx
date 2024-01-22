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
import MulticallOperation from '../../../data/operations/MulticallOperator';
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

  // const mintDatas = chainOperations
  //   .map((chainOperation) => chainOperation.mintData)
  //   .flatMap((data) => data)
  //   .reduce((acc, data) => {
  //     return acc.concat(data.slice(2)) as `0x${string}`;
  //   }, '0x');

  // const modifyDatas = chainOperations
  //   .map((chainOperation) => chainOperation.modifyData)
  //   .flatMap((data) => data)
  //   .reduce((acc, data) => {
  //     return acc.concat(data.slice(2)) as `0x${string}`;
  //   }, '0x');

  const modifyOperation = multicallOperator.combineModifyOperations();

  // const { config: borrowConfig, isLoading: isCheckingIfAbleToBorrow } = usePrepareContractWrite({
  //   address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
  //   abi: borrowerNftAbi,
  //   functionName: 'modify',
  //   args: [
  //     modifyOperation.owner,
  //     modifyOperation.indices,
  //     modifyOperation.managers,
  //     modifyOperation.data,
  //     modifyOperation.antes,
  //   ],
  //   overrides: { value: requiredAnte?.toBigNumber() },
  //   chainId: activeChain.id,
  //   enabled:
  //     accountAddress && encodedModify != null && requiredAnte !== undefined && !isUnhealthy && !notEnoughSupply,
  // });
  // const gasLimit = borrowConfig.request?.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100);
  // const { write: borrow, isLoading: isAskingUserToConfirm } = useContractWrite({
  //   ...borrowConfig,
  //   request: {
  //     ...borrowConfig.request,
  //     gasLimit,
  //   },
  //   onSuccess(data) {
  //     setIsOpen(false);
  //     setPendingTxn(data);
  //   },
  // });

  const {
    config: configMulticallOps,
    isError: isUnableToMulticallOps,
    isLoading: isCheckingIfAbleToMulticallOps,
  } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'multicall',
    args: [[]],
    overrides: {},
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
      {/* {chainOperations.map((chainOperation, index) => {
        return (
          <div key={index}>
            <Text size='M'>Operation {index + 1}</Text>
          </div>
        );
      })} */}
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
