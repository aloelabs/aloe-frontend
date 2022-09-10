import React, { useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { FilledGradientButtonWithIcon } from '../common/Buttons';
import { Text, Display } from '../common/Typography';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';
import { ReactComponent as CheckIcon } from '../../assets/svg/check_black.svg';
import { Action, ActionCardState, ActionID, TokenType, UniswapPosition } from '../../data/Actions';
import { TokenData } from '../../data/TokenData';
import { FeeTier } from '../../data/FeeTier';

import MarginAccountAbi from '../../assets/abis/MarginAccount.json';
import { chain, erc20ABI, useAccount, useBalance, useContractRead, useContractWrite, usePrepareContractWrite, useSigner } from 'wagmi';
import { BigNumber, ethers } from 'ethers';
import { UINT256_MAX } from '../../data/constants/Values';
import { Chain, FetchBalanceResult } from '@wagmi/core';
import Big from 'big.js';
import { toBig } from '../../util/Numbers';
import { UserBalances } from '../../data/UserBalances';
import { Assets, Liabilities, MarginAccount } from '../../data/MarginAccount';
import PendingTxnModal from './modal/PendingTxnModal';
import FailedTxnModal from './modal/FailedTxnModal';
import SuccessModalContent from '../lend/modal/content/SuccessModalContent';
import CreatedMarginAccountModal from './modal/CreatedMarginAccountModal';

const Wrapper = styled.div`
  ${tw`flex flex-col items-center justify-center`}
  background: rgba(13, 24, 33, 1);
  padding: 24px;
  border-radius: 8px;
  width: max-content;
`;

const ActionsList = styled.ul`
  ${tw`flex flex-col items-center`}
  position: relative;
  margin-top: 16px;

  &::before {
    content: '';
    position: absolute;
    left: 15px;
    width: 3px;
    height: 100%;
    border-left: 3px dotted rgba(255, 255, 255, 1);
  }
`;

const ActionItem = styled.li`
  ${tw`w-full flex flex-row items-center`}
  margin-bottom: 16px;
`;

const ActionItemCount = styled.span`
  ${tw`flex flex-col items-center justify-center`}
  position: relative;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 1);
  border: 2px solid rgba(13, 24, 33, 1);
  width: 32px;
  height: 32px;
  margin-right: 32px;
  margin-top: 17px;
  margin-bottom: 17px;
`;

export type ManageAccountWidgetProps = {
  marginAccount: MarginAccount;
  hypotheticalStates: { assets: Assets, liabilities: Liabilities }[],
  uniswapPositions: UniswapPosition[],
  activeActions: Array<Action>;
  actionResults: Array<ActionCardState>;
  updateActionResults: (actionResults: Array<ActionCardState>) => void;
  onAddAction: () => void;
  onRemoveAction: (index: number) => void;
  problematicActionIdx: number;
  transactionIsViable: boolean;
};

function useAllowance(token: TokenData, owner: string, spender: string) {
  return useContractRead({
    addressOrName: token.address,
    contractInterface: erc20ABI,
    functionName: 'allowance',
    args: [owner, spender],
    cacheOnBlock: true,
    watch: true,
  });
}

function useAllowanceWrite(onChain: Chain, token: TokenData, spender: string) {
  return useContractWrite({
    addressOrName: token.address,
    chainId: onChain.id,
    contractInterface: erc20ABI,
    mode: 'recklesslyUnprepared',
    functionName: 'approve',
    args: [spender, UINT256_MAX],
  });
}

function computeBalancesAvailableForEachAction(balances: UserBalances, actionResults: ActionCardState[]): UserBalances[] {
  balances = {...balances};
  const balancesList: UserBalances[] = [{...balances}];

  for (const actionResult of actionResults) {
    switch (actionResult.actionId) {
      case ActionID.TRANSFER_IN:
        balances.amount0Asset -= actionResult.aloeResult?.token0RawDelta || 0;
        balances.amount1Asset -= actionResult.aloeResult?.token1RawDelta || 0;
        balances.amount0Kitty -= actionResult.aloeResult?.token0PlusDelta || 0;
        balances.amount1Kitty -= actionResult.aloeResult?.token1PlusDelta || 0;
        break;
      case ActionID.TRANSFER_OUT:
        // values inside actionResult are negative, so we still subtract in this case.
        // this makes sense, because what happens to userBalances is *opposite* of
        // what happens to the margin account. so we always want to subtract!
        balances.amount0Asset -= actionResult.aloeResult?.token0RawDelta || 0;
        balances.amount1Asset -= actionResult.aloeResult?.token1RawDelta || 0;
        balances.amount0Kitty -= actionResult.aloeResult?.token0PlusDelta || 0;
        balances.amount1Kitty -= actionResult.aloeResult?.token1PlusDelta || 0;
        break;
      default:
        break;
    }

    balancesList.push({...balances});
  }
  return balancesList;
}

function determineAmountsBeingTransferredIn(actionResults: ActionCardState[]): number[] {
  const result = [0, 0, 0, 0];
  for (const actionResult of actionResults) {
    if (actionResult.actionId !== ActionID.TRANSFER_IN) continue;

    switch (actionResult.aloeResult?.selectedToken) {
      case TokenType.ASSET0:
        result[0] += actionResult.aloeResult.token0RawDelta || 0;
        break;
      case TokenType.ASSET1:
        result[1] += actionResult.aloeResult.token1RawDelta || 0;
        break;
      case TokenType.KITTY0:
        result[2] += actionResult.aloeResult.token0PlusDelta || 0;
        break;
      case TokenType.KITTY1:
        result[3] += actionResult.aloeResult.token1PlusDelta || 0;
        break;
      default:
        break;
    }
  }
  return result;
}

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
  READY,
}

function getConfirmButton(state: ConfirmButtonState, token0: TokenData, token1: TokenData, kitty0: TokenData, kitty1: TokenData): {text: string, enabled: boolean} {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET0: return {text: `Insufficient ${token0.ticker}`, enabled: false};
    case ConfirmButtonState.INSUFFICIENT_ASSET1: return {text: `Insufficient ${token1.ticker}`, enabled: false};
    case ConfirmButtonState.INSUFFICIENT_KITTY0: return {text: `Insufficient ${kitty0.ticker}`, enabled: false};
    case ConfirmButtonState.INSUFFICIENT_KITTY1: return {text: `Insufficient ${kitty1.ticker}`, enabled: false};
    case ConfirmButtonState.APPROVE_ASSET0: return {text: `Approve ${token0.ticker}`, enabled: true};
    case ConfirmButtonState.APPROVE_ASSET1: return {text: `Approve ${token1.ticker}`, enabled: true};
    case ConfirmButtonState.APPROVE_KITTY0: return {text: `Approve ${kitty0.ticker}`, enabled: true};
    case ConfirmButtonState.APPROVE_KITTY1: return {text: `Approve ${kitty1.ticker}`, enabled: true};
    case ConfirmButtonState.NO_ACTIONS:
    case ConfirmButtonState.ERRORING_ACTIONS: return {text: 'Confirm', enabled: false};
    case ConfirmButtonState.PENDING: return {text: 'Pending', enabled: false};
    case ConfirmButtonState.READY: return {text: 'Confirm', enabled: true};
  }
}

const MARGIN_ACCOUNT_CALLEE = '0xba9ad27ed23b5e002e831514e69554815a5820b3';

export default function ManageAccountWidget(props: ManageAccountWidgetProps) {
  // MARK: component props
  const {
    marginAccount,
    hypotheticalStates,
    uniswapPositions,
    activeActions,
    actionResults,
    updateActionResults,
    onAddAction,
    onRemoveAction,
    problematicActionIdx,
    transactionIsViable,
  } = props;
  const { address: accountAddress, token0, token1, kitty0, kitty1 } = marginAccount;
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // MARK: wagmi hooks
  const contract = useContractWrite({
    addressOrName: accountAddress,
    // chainId: chain.goerli.id,
    contractInterface: MarginAccountAbi,
    mode: 'recklesslyUnprepared',
    functionName: 'modify',
    onError: () => {
      setShowPendingModal(false);
      setTimeout(() => {
        //Wait till the other modal is fully closed (since otherwise we will mess up page scrolling)
        setShowFailedModal(true);
      }, 500);
    },
    onSuccess: () => {
      setShowPendingModal(false);
      setTimeout(() => {
        //Wait till the other modal is fully closed (since otherwise we will mess up page scrolling)
        setShowSuccessModal(true);
      }, 500);
    },
  });
  const { address: userAddress } = useAccount();
  const { data: userBalance0Asset } = useBalance({ addressOrName: userAddress, token: token0.address });
  const { data: userBalance1Asset } = useBalance({ addressOrName: userAddress, token: token1.address });
  const { data: userBalance0Kitty } = useBalance({ addressOrName: userAddress, token: kitty0.address });
  const { data: userBalance1Kitty } = useBalance({ addressOrName: userAddress, token: kitty1.address });
  const { data: userAllowance0Asset } = useAllowance(token0, userAddress ?? '', MARGIN_ACCOUNT_CALLEE);
  const { data: userAllowance1Asset } = useAllowance(token1, userAddress ?? '', MARGIN_ACCOUNT_CALLEE);
  const { data: userAllowance0Kitty } = useAllowance(kitty0, userAddress ?? '', MARGIN_ACCOUNT_CALLEE);
  const { data: userAllowance1Kitty } = useAllowance(kitty1, userAddress ?? '', MARGIN_ACCOUNT_CALLEE);
  const writeAsset0Allowance = useAllowanceWrite(chain.goerli, token0, MARGIN_ACCOUNT_CALLEE);
  const writeAsset1Allowance = useAllowanceWrite(chain.goerli, token1, MARGIN_ACCOUNT_CALLEE);
  const writeKitty0Allowance = useAllowanceWrite(chain.goerli, kitty0, MARGIN_ACCOUNT_CALLEE);
  const writeKitty1Allowance = useAllowanceWrite(chain.goerli, kitty1, MARGIN_ACCOUNT_CALLEE);

  // MARK: logic to ensure that listed balances and MAXes work
  const userBalances: UserBalances = {
    amount0Asset: Number(userBalance0Asset?.formatted ?? 0) || 0,
    amount1Asset: Number(userBalance1Asset?.formatted ?? 0) || 0,
    amount0Kitty: Number(userBalance0Kitty?.formatted ?? 0) || 0,
    amount1Kitty: Number(userBalance1Kitty?.formatted ?? 0) || 0,
  };
  const balancesAvailableForEachAction = computeBalancesAvailableForEachAction(userBalances, actionResults);

  // MARK: logic to determine what approvals are needed
  const requiredBalances = determineAmountsBeingTransferredIn(actionResults);
  const insufficient = [
    requiredBalances[0] > userBalances.amount0Asset,
    requiredBalances[1] > userBalances.amount1Asset,
    requiredBalances[2] > userBalances.amount0Kitty,
    requiredBalances[3] > userBalances.amount1Kitty,
  ];
  const needsApproval = [
    !userAllowance0Asset || (toBig(userAllowance0Asset).div(token0.decimals).toNumber() < requiredBalances[0]),
    !userAllowance1Asset || (toBig(userAllowance1Asset).div(token1.decimals).toNumber() < requiredBalances[1]),
    !userAllowance0Kitty || (toBig(userAllowance0Kitty).div(kitty0.decimals).toNumber() < requiredBalances[2]),
    !userAllowance1Kitty || (toBig(userAllowance1Kitty).div(kitty1.decimals).toNumber() < requiredBalances[3]),
  ];

  if (writeAsset0Allowance.isError) writeAsset0Allowance.reset();
  if (writeAsset1Allowance.isError) writeAsset1Allowance.reset();
  if (writeKitty0Allowance.isError) writeKitty0Allowance.reset();
  if (writeKitty1Allowance.isError) writeKitty1Allowance.reset();
  if (contract.isError) setTimeout(contract.reset, 500);

  let confirmButtonState = ConfirmButtonState.READY;
  if (activeActions.length === 0) {
    confirmButtonState = ConfirmButtonState.NO_ACTIONS;
  } else if (!transactionIsViable || problematicActionIdx !== -1) {
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

  //TODO: add some sort of error message when !transactionIsViable
  return (
    <Wrapper>
      <div>
        <Display size='M' weight='medium'>
          Manage Account
        </Display>
        <Text size='S' weight='medium'>
          Get started by clicking "Add Action" and transferring some funds as
          margin.
        </Text>
        <ActionsList>
          {activeActions.map((action, index) => (
            <ActionItem key={index}>
              <ActionItemCount>
                <Text size='M' weight='bold' color='rgba(13, 24, 33, 1)'>
                  {index + 1}
                </Text>
              </ActionItemCount>
              <action.actionCard
                marginAccount={{
                  ...marginAccount,
                  assets: (hypotheticalStates.at(index) ?? marginAccount).assets,
                  liabilities: (hypotheticalStates.at(index) ?? marginAccount).liabilities
                }}
                availableBalances={balancesAvailableForEachAction[index]}
                uniswapPositions={uniswapPositions}
                previousActionCardState={actionResults[index]}
                isCausingError={problematicActionIdx !== -1 && index >= problematicActionIdx}
                onRemove={() => {
                  onRemoveAction(index);
                }}
                onChange={(result: ActionCardState) => {
                  updateActionResults([
                    ...actionResults.slice(0, index),
                    result,
                    ...actionResults.slice(index + 1),
                  ]);
                }}
              />
            </ActionItem>
          ))}
          <ActionItem>
            <ActionItemCount>
              <Text size='M' weight='bold' color='rgba(13, 24, 33, 1)'>
                {activeActions.length + 1}
              </Text>
            </ActionItemCount>
            <FilledGradientButtonWithIcon
              Icon={<PlusIcon />}
              position='leading'
              size='S'
              svgColorType='stroke'
              onClick={() => {
                onAddAction();
              }}
            >
              Add Action
            </FilledGradientButtonWithIcon>
          </ActionItem>
        </ActionsList>
        <div className='flex justify-end gap-4 mt-4'>
          <FilledGradientButtonWithIcon
            Icon={<CheckIcon />}
            position='trailing'
            size='M'
            svgColorType='stroke'
            onClick={() => {
              if (!transactionIsViable) {
                console.error('Oops! The transaction couldn\'t be formatted correctly. Please refresh and try again.');
                return;
              }

              const actionIds = actionResults.map((result) => result.actionId);
              const actionArgs = actionResults.map((result) => result.actionArgs!);
              const calldata = ethers.utils.defaultAbiCoder.encode(
                ['uint8[]', 'bytes[]'],
                [actionIds, actionArgs]
              );

              switch (confirmButtonState) {
                case ConfirmButtonState.APPROVE_ASSET0:
                  writeAsset0Allowance.write();
                  break;
                case ConfirmButtonState.APPROVE_ASSET1:
                  writeAsset1Allowance.write();
                  break;
                case ConfirmButtonState.APPROVE_KITTY0:
                  writeKitty0Allowance.write();
                  break;
                case ConfirmButtonState.APPROVE_KITTY1:
                  writeKitty1Allowance.write();
                  break;
                case ConfirmButtonState.READY:
                  contract.write?.({
                    recklesslySetUnpreparedArgs: [
                      '0xba9ad27ed23b5e002e831514e69554815a5820b3',
                      calldata,
                      [UINT256_MAX, UINT256_MAX, UINT256_MAX, UINT256_MAX],
                    ],
                  });
                  setShowPendingModal(true);
                  break;
                default:
                  break;
              }
            }}
            disabled={!confirmButton.enabled}
          >
            {confirmButton.text}
          </FilledGradientButtonWithIcon>
        </div>
      </div>
      <PendingTxnModal
        open={showPendingModal}
        setOpen={setShowPendingModal}
      />
      <FailedTxnModal
        open={showFailedModal}
        setOpen={setShowFailedModal}
      />
      <CreatedMarginAccountModal // TODO duplicate this or rename it for this use-case
        open={showSuccessModal}
        setOpen={setShowSuccessModal}
        onConfirm={() => {}}
      />
    </Wrapper>
  );
}
