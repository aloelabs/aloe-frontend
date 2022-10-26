import { ReactElement, useState } from 'react';

import { BigNumber, ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { FilledGradientButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { Address, chain, Chain, erc20ABI, useContractRead, useContractWrite } from 'wagmi';

import MarginAccountAbi from '../../assets/abis/MarginAccount.json';
import { ReactComponent as AlertTriangleIcon } from '../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../assets/svg/check_black.svg';
import { ReactComponent as LoaderIcon } from '../../assets/svg/loader.svg';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';
import { AccountState, ActionCardOutput } from '../../data/actions/Actions';
import { UINT256_MAX } from '../../data/constants/Values';
import { TokenData } from '../../data/TokenData';
import { UserBalances } from '../../data/UserBalances';
import { toBig } from '../../util/Numbers';
import FailedTxnModal from './modal/FailedTxnModal';
import PendingTxnModal from './modal/PendingTxnModal';
import SuccessfulTxnModal from './modal/SuccessfulTxnModal';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET0,
  INSUFFICIENT_ASSET1,
  INSUFFICIENT_KITTY0,
  INSUFFICIENT_KITTY1,
  APPROVE_ASSET0,
  APPROVE_ASSET1,
  APPROVE_KITTY0,
  APPROVE_KITTY1,
  NO_ACTIONS,
  ERRORING_ACTIONS,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(
  state: ConfirmButtonState,
  token0: TokenData,
  token1: TokenData,
  kitty0: TokenData,
  kitty1: TokenData
): { text: string; Icon: ReactElement; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET0:
      return {
        text: `Insufficient ${token0.ticker}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
      };
    case ConfirmButtonState.INSUFFICIENT_ASSET1:
      return {
        text: `Insufficient ${token1.ticker}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
      };
    case ConfirmButtonState.INSUFFICIENT_KITTY0:
      return {
        text: `Insufficient ${kitty0.ticker}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
      };
    case ConfirmButtonState.INSUFFICIENT_KITTY1:
      return {
        text: `Insufficient ${kitty1.ticker}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
      };
    case ConfirmButtonState.APPROVE_ASSET0:
      return {
        text: `Approve ${token0.ticker}`,
        Icon: <CheckIcon />,
        enabled: true,
      };
    case ConfirmButtonState.APPROVE_ASSET1:
      return {
        text: `Approve ${token1.ticker}`,
        Icon: <CheckIcon />,
        enabled: true,
      };
    case ConfirmButtonState.APPROVE_KITTY0:
      return {
        text: `Approve ${kitty0.ticker}`,
        Icon: <CheckIcon />,
        enabled: true,
      };
    case ConfirmButtonState.APPROVE_KITTY1:
      return {
        text: `Approve ${kitty1.ticker}`,
        Icon: <CheckIcon />,
        enabled: true,
      };
    case ConfirmButtonState.LOADING:
    case ConfirmButtonState.NO_ACTIONS:
    case ConfirmButtonState.ERRORING_ACTIONS:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: false };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', Icon: <LoaderIcon />, enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: true };
  }
}

function useAllowance(token: TokenData, owner: Address, spender: Address) {
  return useContractRead({
    address: token.address,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [owner, spender],
    cacheOnBlock: true,
    watch: true,
  });
}

function useAllowanceWrite(onChain: Chain, token: TokenData, spender: Address) {
  return useContractWrite({
    address: token.address,
    abi: erc20ABI,
    chainId: onChain.id,
    mode: 'recklesslyUnprepared',
    functionName: 'approve',
    args: [spender, ethers.constants.MaxUint256],
  });
}

export type ManageAccountTransactionButtonProps = {
  userAddress: Address | undefined;
  accountAddress: Address;
  token0: TokenData;
  token1: TokenData;
  kitty0: TokenData;
  kitty1: TokenData;
  userBalances: UserBalances;
  accountState: AccountState;
  actionOutputs: ActionCardOutput[];
  transactionWillFail: boolean;
  onSuccessReceipt: () => void;
};

const MARGIN_ACCOUNT_CALLEE = '0xbafcdca9576ca3db1b5e0b4190ad8b4424eb813d';

export function ManageAccountTransactionButton(props: ManageAccountTransactionButtonProps) {
  const {
    userAddress,
    accountAddress,
    token0,
    token1,
    kitty0,
    kitty1,
    userBalances,
    accountState,
    actionOutputs,
    transactionWillFail,
    onSuccessReceipt,
  } = props;

  // modals
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  // transaction state
  const [pendingTxnHash, setPendingTxnHash] = useState<string | undefined>(undefined);

  const navigate = useNavigate();

  const contract = useContractWrite({
    address: accountAddress,
    abi: MarginAccountAbi,
    mode: 'recklesslyUnprepared',
    functionName: 'modify',
    onSuccess: () => {
      setShowPendingModal(true);
    },
  });

  const { data: userAllowance0Asset } = useAllowance(token0, userAddress ?? '0x', MARGIN_ACCOUNT_CALLEE);
  const { data: userAllowance1Asset } = useAllowance(token1, userAddress ?? '0x', MARGIN_ACCOUNT_CALLEE);
  const { data: userAllowance0Kitty } = useAllowance(kitty0, userAddress ?? '0x', MARGIN_ACCOUNT_CALLEE);
  const { data: userAllowance1Kitty } = useAllowance(kitty1, userAddress ?? '0x', MARGIN_ACCOUNT_CALLEE);
  const writeAsset0Allowance = useAllowanceWrite(chain.goerli, token0, MARGIN_ACCOUNT_CALLEE);
  const writeAsset1Allowance = useAllowanceWrite(chain.goerli, token1, MARGIN_ACCOUNT_CALLEE);
  const writeKitty0Allowance = useAllowanceWrite(chain.goerli, kitty0, MARGIN_ACCOUNT_CALLEE);
  const writeKitty1Allowance = useAllowanceWrite(chain.goerli, kitty1, MARGIN_ACCOUNT_CALLEE);

  const requiredBalances = [
    accountState.requiredAllowances.amount0Asset,
    accountState.requiredAllowances.amount1Asset,
    accountState.requiredAllowances.amount0Kitty,
    accountState.requiredAllowances.amount1Kitty,
  ];
  const insufficient = [
    requiredBalances[0] > userBalances.amount0Asset,
    requiredBalances[1] > userBalances.amount1Asset,
    requiredBalances[2] > userBalances.amount0Kitty,
    requiredBalances[3] > userBalances.amount1Kitty,
  ];
  const loadingApprovals = [
    requiredBalances[0] > 0 && !userAllowance0Asset,
    requiredBalances[1] > 0 && !userAllowance1Asset,
    requiredBalances[2] > 0 && !userAllowance0Kitty,
    requiredBalances[3] > 0 && !userAllowance1Kitty,
  ];
  const needsApproval = [
    userAllowance0Asset && toBig(userAllowance0Asset).div(token0.decimals).toNumber() < requiredBalances[0],
    userAllowance1Asset && toBig(userAllowance1Asset).div(token1.decimals).toNumber() < requiredBalances[1],
    userAllowance0Kitty && toBig(userAllowance0Kitty).div(kitty0.decimals).toNumber() < requiredBalances[2],
    userAllowance1Kitty && toBig(userAllowance1Kitty).div(kitty1.decimals).toNumber() < requiredBalances[3],
  ];

  if (writeAsset0Allowance.isError) writeAsset0Allowance.reset();
  if (writeAsset1Allowance.isError) writeAsset1Allowance.reset();
  if (writeKitty0Allowance.isError) writeKitty0Allowance.reset();
  if (writeKitty1Allowance.isError) writeKitty1Allowance.reset();
  if (contract.isError || contract.isSuccess) setTimeout(contract.reset, 500);

  // check whether we're prepared to send a transaction (independent of whether transaction will succeed/fail)
  const canConstructTransaction = actionOutputs.findIndex((o) => o.actionArgs === undefined) === -1;

  let confirmButtonState = ConfirmButtonState.READY;
  if (actionOutputs.length === 0) {
    confirmButtonState = ConfirmButtonState.NO_ACTIONS;
  } else if (loadingApprovals.includes(true)) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (!canConstructTransaction || transactionWillFail) {
    confirmButtonState = ConfirmButtonState.ERRORING_ACTIONS;
  } else if (insufficient[0]) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET0;
  } else if (insufficient[1]) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET1;
  } else if (insufficient[2]) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_KITTY0;
  } else if (insufficient[3]) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_KITTY1;
  } else if (needsApproval[0] && writeAsset0Allowance.isIdle) {
    confirmButtonState = ConfirmButtonState.APPROVE_ASSET0;
  } else if (needsApproval[1] && writeAsset1Allowance.isIdle) {
    confirmButtonState = ConfirmButtonState.APPROVE_ASSET1;
  } else if (needsApproval[2] && writeKitty0Allowance.isIdle) {
    confirmButtonState = ConfirmButtonState.APPROVE_KITTY0;
  } else if (needsApproval[3] && writeKitty1Allowance.isIdle) {
    confirmButtonState = ConfirmButtonState.APPROVE_KITTY1;
  } else if (needsApproval.includes(true)) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (contract.isIdle) {
    confirmButtonState = ConfirmButtonState.READY;
  } else {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token0, token1, kitty0, kitty1);

  return (
    <div>
      <FilledGradientButtonWithIcon
        Icon={confirmButton.Icon}
        position='trailing'
        size='M'
        svgColorType='stroke'
        onClick={() => {
          if (!canConstructTransaction) {
            console.error("Oops! The transaction couldn't be formatted correctly. Please refresh and try again.");
            return;
          }

          const actionIds = actionOutputs.map((o) => o.actionId);
          const actionArgs = actionOutputs.map((o) => o.actionArgs!);
          const calldata = ethers.utils.defaultAbiCoder.encode(['uint8[]', 'bytes[]'], [actionIds, actionArgs]);

          switch (confirmButtonState) {
            case ConfirmButtonState.APPROVE_ASSET0:
              writeAsset0Allowance.write?.();
              break;
            case ConfirmButtonState.APPROVE_ASSET1:
              writeAsset1Allowance.write?.();
              break;
            case ConfirmButtonState.APPROVE_KITTY0:
              writeKitty0Allowance.write?.();
              break;
            case ConfirmButtonState.APPROVE_KITTY1:
              writeKitty1Allowance.write?.();
              break;
            case ConfirmButtonState.READY:
              contract
                .writeAsync?.({
                  recklesslySetUnpreparedArgs: [
                    MARGIN_ACCOUNT_CALLEE,
                    calldata,
                    [UINT256_MAX, UINT256_MAX, UINT256_MAX, UINT256_MAX],
                  ],
                  recklesslySetUnpreparedOverrides: {
                    // TODO gas estimation was occassionally causing errors. To fix this,
                    // we should probably work with the underlying ethers.Contract, but for now
                    // we just provide hard-coded overrides.
                    gasLimit: BigNumber.from((600000 + 200000 * actionIds.length).toFixed(0)),
                  },
                })
                .then((txnResult) => {
                  // In this callback, we have a txnResult. This means that the transaction has been submitted
                  // to the blockchain and/or the user rejected it entirely. These states correspond to
                  // contract.isError and contract.isSuccess, which we deal with elsewhere.
                  setPendingTxnHash(txnResult.hash);

                  txnResult.wait(1).then((txnReceipt) => {
                    // In this callback, the transaction has been included on the blockchain and at least 1 block
                    // has been built on top of it.
                    setShowPendingModal(false);
                    setPendingTxnHash(undefined);
                    if (txnReceipt.status === 1) {
                      // TODO in addition to clearing actions here, we should refresh the page to get updated data
                      onSuccessReceipt();
                    }

                    console.log(txnReceipt);

                    setTimeout(() => {
                      //Wait till the other modal is fully closed (since otherwise we will mess up page scrolling)
                      if (txnReceipt.status === 1) setShowSuccessModal(true);
                      else setShowFailedModal(true);
                    }, 500);
                  });
                });
              break;
            default:
              break;
          }
        }}
        disabled={!confirmButton.enabled}
      >
        {confirmButton.text}
      </FilledGradientButtonWithIcon>
      <PendingTxnModal open={showPendingModal} setOpen={setShowPendingModal} txnHash={pendingTxnHash} />
      <FailedTxnModal open={showFailedModal} setOpen={setShowFailedModal} />
      <SuccessfulTxnModal
        open={showSuccessModal}
        setOpen={setShowSuccessModal}
        onConfirm={() => {
          setTimeout(() => navigate(0), 100);
        }}
      />
    </div>
  );
}
