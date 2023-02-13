import { useContext, useEffect, useMemo, useState } from 'react';

import { FilledGradientButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Address, useAccount, useBalance } from 'wagmi';

import { ChainContext } from '../../App';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';
import {
  AccountState,
  Action,
  ActionCardOutput,
  calculateHypotheticalStates,
  UniswapPosition,
} from '../../data/actions/Actions';
import { RESPONSIVE_BREAKPOINT_SM, RESPONSIVE_BREAKPOINT_XS } from '../../data/constants/Breakpoints';
import { isSolvent, MarginAccount, MarketInfo } from '../../data/MarginAccount';
import { UserBalances } from '../../data/UserBalances';
import BorrowSelectActionModal from './BorrowSelectActionModal';
import HealthBar from './HealthBar';
import { ManageAccountTransactionButton } from './ManageAccountTransactionButton';

const Wrapper = styled.div`
  ${tw`flex flex-col items-center justify-center`}
  background: rgba(13, 23, 30, 1);
  padding: 24px;
  border-radius: 8px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    width: 100%;
  }

  position: relative;
  &:before {
    content: '';
    position: absolute;
    z-index: 0;
    inset: 0;
    pointer-events: none;
    border-radius: 8px;
    padding: 1.5px 1.5px 1.5px 1.5px;
    background: linear-gradient(90deg, #9baaf3 0%, #7bd8c0 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
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
  border: 2px solid rgba(13, 23, 30, 1);
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
  marketInfo: MarketInfo | null;
  marginAccount: MarginAccount;
  uniswapPositions: readonly UniswapPosition[];
  updateHypotheticalState: (state: AccountState | null) => void;
  onAddFirstAction: () => void;
};

export default function ManageAccountWidget(props: ManageAccountWidgetProps) {
  // MARK: component props
  const { marketInfo, marginAccount, uniswapPositions, updateHypotheticalState, onAddFirstAction } = props;
  const { address: accountAddress, token0, token1 } = marginAccount;

  const { activeChain } = useContext(ChainContext);

  // MARK: component state
  // actions
  const [userInputFields, setUserInputFields] = useState<(string[] | undefined)[]>([]);
  const [actionOutputs, setActionOutputs] = useState<ActionCardOutput[]>([]);
  const [activeActions, setActiveActions] = useState<Action[]>([]);
  const [hypotheticalStates, setHypotheticalStates] = useState<AccountState[]>([]);
  // modals
  const [showAddActionModal, setShowAddActionModal] = useState(false);

  // MARK: chain agnostic wagmi rate-limiter
  const [shouldEnableWagmiHooks, setShouldEnableWagmiHooks] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => setShouldEnableWagmiHooks(Date.now() % 15_000 < 1_000), 500);
    return () => {
      clearInterval(interval);
    };
  }, []);

  // MARK: wagmi hooks
  const { address: userAddress } = useAccount();
  const { data: userBalance0Asset } = useBalance({
    address: userAddress ?? '0x',
    token: token0.address,
    chainId: activeChain.id,
    enabled: shouldEnableWagmiHooks && !!userAddress,
  });
  const { data: userBalance1Asset } = useBalance({
    address: userAddress ?? '0x',
    token: token1.address,
    chainId: activeChain.id,
    enabled: shouldEnableWagmiHooks && !!userAddress,
  });

  // MARK: logic to ensure that listed balances and MAXes work
  const userBalances: UserBalances = useMemo(
    () => ({
      amount0Asset: Number(userBalance0Asset?.formatted ?? 0) || 0,
      amount1Asset: Number(userBalance1Asset?.formatted ?? 0) || 0,
    }),
    [userBalance0Asset, userBalance1Asset]
  );

  const initialState: AccountState = useMemo(
    () => ({
      assets: marginAccount.assets,
      liabilities: marginAccount.liabilities,
      uniswapPositions: uniswapPositions,
      availableBalances: userBalances,
      requiredAllowances: {
        amount0Asset: 0,
        amount1Asset: 0,
      },
      claimedFeeUniswapKeys: [],
    }),
    [marginAccount, uniswapPositions, userBalances]
  );

  useEffect(() => {
    const operators = actionOutputs.map((o) => o.operator);
    const states = calculateHypotheticalStates(marginAccount, initialState, operators);
    setHypotheticalStates(states);
    updateHypotheticalState(states.length > 1 ? states[states.length - 1] : null);
  }, [actionOutputs, marginAccount, initialState, updateHypotheticalState]);

  const finalState = hypotheticalStates.at(hypotheticalStates.length - 1) ?? initialState;
  const numValidActions = hypotheticalStates.length - 1;

  const { health } = isSolvent(
    finalState.assets,
    finalState.liabilities,
    finalState.uniswapPositions,
    marginAccount.sqrtPriceX96,
    marginAccount.iv,
    token0.decimals,
    token1.decimals
  );

  if (marketInfo === null) return null;

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
                <Text size='M' weight='bold' color='rgba(13, 23, 30, 1)'>
                  {index + 1}
                </Text>
              </ActionItemCount>
              <ActionCardWrapper>
                <action.actionCard
                  marketInfo={marketInfo}
                  marginAccount={marginAccount}
                  accountState={hypotheticalStates.at(index) ?? finalState}
                  userInputFields={userInputFields.at(index)}
                  isCausingError={index >= numValidActions && userInputFields.at(index) !== undefined}
                  forceOutput={actionOutputs.length === index}
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
              <Text size='M' weight='bold' color='rgba(13, 23, 30, 1)'>
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
        <HealthBar health={health} />
        <div className='flex justify-end gap-4 mt-4'>
          <ManageAccountTransactionButton
            userAddress={userAddress}
            accountAddress={accountAddress as Address}
            token0={token0}
            token1={token1}
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
          if (activeActions.length === 0) onAddFirstAction();
          setActiveActions([...activeActions, action]);
        }}
        handleAddActions={(actions, templatedInputFields) => {
          if (activeActions.length === 0) onAddFirstAction();
          setActiveActions([...activeActions, ...actions]);
          if (templatedInputFields) setUserInputFields([...userInputFields, ...templatedInputFields]);
        }}
      />
    </Wrapper>
  );
}
