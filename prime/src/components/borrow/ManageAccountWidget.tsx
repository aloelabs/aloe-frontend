import { useEffect, useState } from 'react';

import { FilledGradientButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Address, useAccount, useBalance } from 'wagmi';

import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';
import {
  AccountState,
  Action,
  ActionCardOutput,
  calculateHypotheticalStates,
  UniswapPosition,
} from '../../data/actions/Actions';
import { RESPONSIVE_BREAKPOINT_SM, RESPONSIVE_BREAKPOINT_XS } from '../../data/constants/Breakpoints';
import { MarginAccount } from '../../data/MarginAccount';
import { UserBalances } from '../../data/UserBalances';
import BorrowSelectActionModal from './BorrowSelectActionModal';
import { ManageAccountTransactionButton } from './ManageAccountTransactionButton';

const Wrapper = styled.div`
  ${tw`flex flex-col items-center justify-center`}
  background: rgba(13, 24, 33, 1);
  padding: 24px;
  border-radius: 8px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    width: 100%;
  }
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

    @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
      display: none;
    }
  }
`;

const ActionItem = styled.li`
  ${tw`w-full flex`}
  flex-direction: row;
  align-items: center;
  margin-bottom: 16px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    align-items: start;
    flex-direction: column;
  }
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

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    margin-right: 0;
  }
`;

const ActionCardWrapper = styled.div`
  width: 400px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    width: 350px;
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    width: 300px;
  }
`;

export type ManageAccountWidgetProps = {
  marginAccount: MarginAccount;
  uniswapPositions: readonly UniswapPosition[];
  setHypotheticalState: (state: AccountState | null) => void;
};

export default function ManageAccountWidget(props: ManageAccountWidgetProps) {
  // MARK: component props
  const { marginAccount, uniswapPositions, setHypotheticalState } = props;
  const { address: accountAddress, token0, token1, kitty0, kitty1 } = marginAccount;

  // actions
  const [userInputFields, setUserInputFields] = useState<(string[] | undefined)[]>([]);
  const [actionOutputs, setActionOutputs] = useState<ActionCardOutput[]>([]);
  const [activeActions, setActiveActions] = useState<Action[]>([]);
  const [hypotheticalStates, setHypotheticalStates] = useState<AccountState[]>([]);
  // modals
  const [showAddActionModal, setShowAddActionModal] = useState(false);

  // MARK: wagmi hooks
  const { address: userAddress } = useAccount();
  const { data: userBalance0Asset } = useBalance({
    addressOrName: userAddress,
    token: token0.address,
    watch: true,
  });
  const { data: userBalance1Asset } = useBalance({
    addressOrName: userAddress,
    token: token1.address,
    watch: true,
  });
  const { data: userBalance0Kitty } = useBalance({
    addressOrName: userAddress,
    token: kitty0.address,
    watch: true,
  });
  const { data: userBalance1Kitty } = useBalance({
    addressOrName: userAddress,
    token: kitty1.address,
    watch: true,
  });

  // MARK: logic to ensure that listed balances and MAXes work
  const userBalances: UserBalances = {
    amount0Asset: Number(userBalance0Asset?.formatted ?? 0) || 0,
    amount1Asset: Number(userBalance1Asset?.formatted ?? 0) || 0,
    amount0Kitty: Number(userBalance0Kitty?.formatted ?? 0) || 0,
    amount1Kitty: Number(userBalance1Kitty?.formatted ?? 0) || 0,
  };

  const initialState: AccountState = {
    assets: marginAccount.assets,
    liabilities: marginAccount.liabilities,
    uniswapPositions: uniswapPositions,
    availableBalances: userBalances,
    requiredAllowances: {
      amount0Asset: 0,
      amount1Asset: 0,
      amount0Kitty: 0,
      amount1Kitty: 0,
    },
  };

  useEffect(() => {
    console.log('Updating hypothetical states');

    const operators = actionOutputs.map((o) => o.operator);
    const states = calculateHypotheticalStates(marginAccount, initialState, operators);
    setHypotheticalStates(states);
    setHypotheticalState(states.length > 1 ? states[states.length - 1] : null);
  }, [
    marginAccount,
    uniswapPositions,
    userBalance0Asset,
    userBalance1Asset,
    userBalance0Kitty,
    userBalance1Kitty,
    actionOutputs,
  ]);

  const finalState = hypotheticalStates.at(hypotheticalStates.length - 1) ?? initialState;
  const numValidActions = hypotheticalStates.length - 1;

  //TODO: add some sort of error message when !transactionIsViable
  return (
    <Wrapper>
      <div>
        <ActionCardWrapper>
          <Display size='M' weight='medium'>
            Manage Account
          </Display>
          <Text size='S' weight='medium'>
            Get started by clicking "Add Action" and transferring some funds as margin.
          </Text>
        </ActionCardWrapper>
        <ActionsList>
          {activeActions.map((action, index) => (
            <ActionItem key={index}>
              <ActionItemCount>
                <Text size='M' weight='bold' color='rgba(13, 24, 33, 1)'>
                  {index + 1}
                </Text>
              </ActionItemCount>
              <ActionCardWrapper>
                <action.actionCard
                  marginAccount={marginAccount}
                  accountState={hypotheticalStates.at(index) ?? finalState}
                  userInputFields={userInputFields.at(index)}
                  isCausingError={index >= numValidActions && userInputFields.at(index) !== undefined}
                  forceOutput={userInputFields.at(index) !== undefined && actionOutputs.length === index}
                  onChange={(output: ActionCardOutput, userInputs: string[]) => {
                    console.log('OUTPUT', index, output, userInputs);
                    setUserInputFields([
                      ...userInputFields.slice(0, index),
                      userInputs,
                      ...userInputFields.slice(index + 1),
                    ]);
                    setActionOutputs([...actionOutputs.slice(0, index), output, ...actionOutputs.slice(index + 1)]);
                  }}
                  onRemove={() => {
                    const newActionOutputs = [...actionOutputs];
                    newActionOutputs.splice(index, 1);
                    setActionOutputs(newActionOutputs);
                    const newUserInputFields = [...userInputFields];
                    newUserInputFields.splice(index, 1);
                    setUserInputFields(newUserInputFields);
                    const newActiveActions = [...activeActions];
                    newActiveActions.splice(index, 1);
                    setActiveActions(newActiveActions);
                  }}
                />
              </ActionCardWrapper>
            </ActionItem>
          ))}
          <ActionItem>
            <ActionItemCount>
              <Text size='M' weight='bold' color='rgba(13, 24, 33, 1)'>
                {activeActions.length + 1}
              </Text>
            </ActionItemCount>
            <ActionCardWrapper>
              <FilledGradientButtonWithIcon
                Icon={<PlusIcon />}
                position='leading'
                size='S'
                svgColorType='stroke'
                onClick={() => {
                  setShowAddActionModal(true);
                }}
              >
                Add Action
              </FilledGradientButtonWithIcon>
            </ActionCardWrapper>
          </ActionItem>
        </ActionsList>
        <div className='flex justify-end gap-4 mt-4'>
          <ManageAccountTransactionButton
            userAddress={userAddress}
            accountAddress={accountAddress as Address}
            token0={token0}
            token1={token1}
            kitty0={kitty0}
            kitty1={kitty1}
            userBalances={userBalances}
            accountState={finalState}
            actionOutputs={actionOutputs}
            transactionWillFail={activeActions.length > numValidActions}
            onSuccessReceipt={() => {
              setActionOutputs([]);
              setUserInputFields([]);
              setActiveActions([]);
            }}
          />
        </div>
      </div>
      <BorrowSelectActionModal
        isOpen={showAddActionModal}
        setIsOpen={setShowAddActionModal}
        handleAddAction={(action: Action) => {
          setActiveActions([...activeActions, action]);
        }}
        handleAddActions={(actions, templatedInputFields) => {
          setActiveActions([...activeActions, ...actions]);
          if (templatedInputFields) setUserInputFields([...userInputFields, ...templatedInputFields]);
        }}
      />
      <BorrowSelectActionModal
        isOpen={showAddActionModal}
        setIsOpen={setShowAddActionModal}
        handleAddAction={(action: Action) => {
          setActiveActions([...activeActions, action]);
        }}
        handleAddActions={(actions, templatedInputFields) => {
          setActiveActions([...activeActions, ...actions]);
          if (templatedInputFields) setUserInputFields([...userInputFields, ...templatedInputFields]);
        }}
      />
    </Wrapper>
  );
}
