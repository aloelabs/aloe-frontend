import { ReactElement, useContext, useState } from 'react';

import { BigNumber, ethers } from 'ethers';
import JSBI from 'jsbi';
import { useNavigate } from 'react-router-dom';
import { FilledGradientButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { Address, Chain, erc20ABI, useBalance, useContractRead, useContractWrite } from 'wagmi';

import { ChainContext } from '../../App';
import MarginAccountAbi from '../../assets/abis/MarginAccount.json';
import { ReactComponent as AlertTriangleIcon } from '../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../assets/svg/check_black.svg';
import { ReactComponent as LoaderIcon } from '../../assets/svg/loader.svg';
import { getFrontendManagerCodeFor } from '../../data/actions/ActionID';
import { AccountState, ActionCardOutput } from '../../data/actions/Actions';
import { ALOE_II_FRONTEND_MANAGER_ADDRESS } from '../../data/constants/Addresses';
import { UINT256_MAX } from '../../data/constants/Values';
import { Token } from '../../data/Token';
import { UserBalances } from '../../data/UserBalances';
import { toBig } from '../../util/Numbers';
import FailedTxnModal from './modal/FailedTxnModal';
import PendingTxnModal from './modal/PendingTxnModal';
import SuccessfulTxnModal from './modal/SuccessfulTxnModal';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET0,
  INSUFFICIENT_ASSET1,
  APPROVE_ASSET0,
  APPROVE_ASSET1,
  NO_ACTIONS,
  ERRORING_ACTIONS,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(
  state: ConfirmButtonState,
  token0: Token,
  token1: Token
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

function useAllowance(onChain: Chain, token: Token, owner: Address, spender: Address) {
  return useContractRead({
    address: token.address,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [owner, spender],
    cacheOnBlock: true,
    watch: true,
    chainId: onChain.id,
    enabled: owner !== '0x',
  });
}

function useAllowanceWrite(onChain: Chain, token: Token, spender: Address) {
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
  token0: Token;
  token1: Token;
  userBalances: UserBalances;
  accountState: AccountState;
  actionOutputs: ActionCardOutput[];
  transactionWillFail: boolean;
  onSuccessReceipt: () => void;
};

const ANTE = 0.001e18; // TODO move to constants

export function ManageAccountTransactionButton(props: ManageAccountTransactionButtonProps) {
  const {
    userAddress,
    accountAddress,
    token0,
    token1,
    userBalances,
    accountState,
    actionOutputs,
    transactionWillFail,
    onSuccessReceipt,
  } = props;
  const { activeChain } = useContext(ChainContext);

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
    chainId: activeChain.id,
  });

  const { data: accountEtherBalance } = useBalance({
    addressOrName: accountAddress,
    watch: true,
  });

  const { data: userAllowance0Asset } = useAllowance(
    activeChain,
    token0,
    userAddress ?? '0x',
    ALOE_II_FRONTEND_MANAGER_ADDRESS
  );
  const { data: userAllowance1Asset } = useAllowance(
    activeChain,
    token1,
    userAddress ?? '0x',
    ALOE_II_FRONTEND_MANAGER_ADDRESS
  );
  const writeAsset0Allowance = useAllowanceWrite(activeChain, token0, ALOE_II_FRONTEND_MANAGER_ADDRESS);
  const writeAsset1Allowance = useAllowanceWrite(activeChain, token1, ALOE_II_FRONTEND_MANAGER_ADDRESS);

  const requiredBalances = [accountState.requiredAllowances.amount0Asset, accountState.requiredAllowances.amount1Asset];
  const insufficient = [
    requiredBalances[0] > userBalances.amount0Asset,
    requiredBalances[1] > userBalances.amount1Asset,
  ];
  const loadingApprovals = [
    requiredBalances[0] > 0 && !userAllowance0Asset,
    requiredBalances[1] > 0 && !userAllowance1Asset,
  ];
  const needsApproval = [
    userAllowance0Asset && toBig(userAllowance0Asset).div(token0.decimals).toNumber() < requiredBalances[0],
    userAllowance1Asset && toBig(userAllowance1Asset).div(token1.decimals).toNumber() < requiredBalances[1],
  ];

  if (writeAsset0Allowance.isError) writeAsset0Allowance.reset();
  if (writeAsset1Allowance.isError) writeAsset1Allowance.reset();
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
  } else if (needsApproval[0] && writeAsset0Allowance.isIdle) {
    confirmButtonState = ConfirmButtonState.APPROVE_ASSET0;
  } else if (needsApproval[1] && writeAsset1Allowance.isIdle) {
    confirmButtonState = ConfirmButtonState.APPROVE_ASSET1;
  } else if (needsApproval.includes(true)) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (contract.isIdle) {
    confirmButtonState = ConfirmButtonState.READY;
  } else {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token0, token1);

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

          const actionIds = actionOutputs.map((o) => getFrontendManagerCodeFor(o.actionId));
          const actionArgs = actionOutputs.map((o) => o.actionArgs!);
          const positions: number[] = [];

          // if Uniswap positions are being changed, make sure to send an updated array of positions
          if (actionIds.includes(4) || actionIds.includes(5)) {
            accountState.uniswapPositions.forEach((position) => {
              if (!JSBI.EQ(position.liquidity, JSBI.BigInt(0))) {
                positions.push(position.lower);
                positions.push(position.upper);
              }
            });
          }

          // provide ante if necessary
          const shouldProvideAnte =
            accountEtherBalance &&
            accountEtherBalance.value.toNumber() < ANTE &&
            (accountState.liabilities.amount0 > 0 || accountState.liabilities.amount1 > 0);

          const calldata = ethers.utils.defaultAbiCoder.encode(
            ['uint8[]', 'bytes[]', 'int24[]'],
            [actionIds, actionArgs, positions]
          );

          switch (confirmButtonState) {
            case ConfirmButtonState.APPROVE_ASSET0:
              writeAsset0Allowance.write?.();
              break;
            case ConfirmButtonState.APPROVE_ASSET1:
              writeAsset1Allowance.write?.();
              break;
            case ConfirmButtonState.READY:
              contract
                .writeAsync?.({
                  recklesslySetUnpreparedArgs: [ALOE_II_FRONTEND_MANAGER_ADDRESS, calldata, [UINT256_MAX, UINT256_MAX]],
                  recklesslySetUnpreparedOverrides: {
                    // TODO gas estimation was occassionally causing errors. To fix this,
                    // we should probably work with the underlying ethers.Contract, but for now
                    // we just provide hard-coded overrides.
                    gasLimit: BigNumber.from((600000 + 200000 * actionIds.length).toFixed(0)),
                    value: shouldProvideAnte ? ANTE + 1 : undefined,
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
