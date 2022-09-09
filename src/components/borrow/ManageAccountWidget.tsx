import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { FilledGradientButtonWithIcon } from '../common/Buttons';
import { Text, Display } from '../common/Typography';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';
import { ReactComponent as CheckIcon } from '../../assets/svg/check_black.svg';
import { Action, ActionCardState, ActionID, TokenType } from '../../data/Actions';
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

function determineWhichTokensAreBeingTransferredIn(actionResults: ActionCardState[]): boolean[] {
  const result = [false, false, false, false];
  for (const actionResult of actionResults) {
    if (actionResult.actionId !== ActionID.TRANSFER_IN) continue;

    switch (actionResult.aloeResult?.selectedToken) {
      case TokenType.ASSET0:
        result[0] = true;
        break;
      case TokenType.ASSET1:
        result[1] = true;
        break;
      case TokenType.KITTY0:
        result[2] = true;
        break;
      case TokenType.KITTY1:
        result[3] = true;
        break;
      default:
        break;
    }
  }
  return result;
}

const MARGIN_ACCOUNT_CALLEE = '0xba9ad27ed23b5e002e831514e69554815a5820b3';

export default function ManageAccountWidget(props: ManageAccountWidgetProps) {
  // MARK: component props
  const {
    marginAccount,
    hypotheticalStates,
    activeActions,
    actionResults,
    updateActionResults,
    onAddAction,
    onRemoveAction,
    problematicActionIdx,
    transactionIsViable,
  } = props;
  const { address: accountAddress, token0, token1, kitty0, kitty1 } = marginAccount;

  // MARK: wagmi hooks
  const contract = useContractWrite({
    addressOrName: accountAddress,
    // chainId: chain.goerli.id,
    contractInterface: MarginAccountAbi,
    mode: 'recklesslyUnprepared',
    functionName: 'modify',
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
  const [
    isUsingAsset0,
    isUsingAsset1,
    isUsingKitty0,
    isUsingKitty1
  ] = determineWhichTokensAreBeingTransferredIn(actionResults);
  const needsAsset0Approval = !userAllowance0Asset ||
    (isUsingAsset0 && toBig(userAllowance0Asset as unknown as BigNumber).div(token0.decimals).toNumber() < userBalances.amount0Asset);
  const needsAsset1Approval = !userAllowance1Asset ||
    (isUsingAsset1 && toBig(userAllowance1Asset as unknown as BigNumber).div(token1.decimals).toNumber() < userBalances.amount1Asset);
  const needsKitty0Approval = !userAllowance0Kitty ||
    (isUsingKitty0 && toBig(userAllowance0Kitty as unknown as BigNumber).div(kitty0.decimals).toNumber() < userBalances.amount0Kitty);
  const needsKitty1Approval = !userAllowance1Kitty ||
    (isUsingKitty1 && toBig(userAllowance1Kitty as unknown as BigNumber).div(kitty1.decimals).toNumber() < userBalances.amount1Kitty);

  const disableConfirmButton = activeActions.length === 0 || !transactionIsViable;/* || (
    Number(needsAsset0Approval) + Number(needsAsset1Approval) + Number(needsKitty0Approval) + Number(needsKitty1Approval) <
    Number(!writeAsset0Allowance.isIdle) + Number(!writeAsset1Allowance.isIdle) + Number(!writeKitty0Allowance.isIdle) + Number(!writeKitty0Allowance.isIdle)
  );*/

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

              if (needsAsset0Approval && writeAsset0Allowance.isIdle) {
                writeAsset0Allowance.write();
              }
              if (needsAsset1Approval && writeAsset1Allowance.isIdle) {
                writeAsset1Allowance.write();
              }
              if (needsKitty0Approval && writeKitty0Allowance.isIdle) {
                writeKitty0Allowance.write();
              }
              if (needsKitty1Approval && writeKitty1Allowance.isIdle) {
                writeKitty1Allowance.write();
              }

              const actionIds = actionResults.map((result) => result.actionId);
              const actionArgs = actionResults.map((result) => result.actionArgs!);
              const calldata = ethers.utils.defaultAbiCoder.encode(
                ['uint8[]', 'bytes[]'],
                [actionIds, actionArgs]
              );

              console.log(contract.write?.({
                recklesslySetUnpreparedArgs: [
                  '0xba9ad27ed23b5e002e831514e69554815a5820b3',
                  calldata,
                  [UINT256_MAX, UINT256_MAX, UINT256_MAX, UINT256_MAX],
                ],
              }));
            }}
            disabled={disableConfirmButton}
          >
            Confirm
          </FilledGradientButtonWithIcon>
        </div>
      </div>
    </Wrapper>
  );
}
