import { useEffect, useMemo, useRef, useState } from 'react';

import { FilledGradientButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_800 } from 'shared/lib/data/constants/Colors';
import { GN } from 'shared/lib/data/GoodNumber';
import useChain from 'shared/lib/data/hooks/UseChain';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Address } from 'viem';
import { useAccount, useBalance } from 'wagmi';

import BorrowSelectActionModal from './BorrowSelectActionModal';
import HealthBar from './HealthBar';
import { ManageAccountTransactionButton } from './ManageAccountTransactionButton';
import SaveTemplateButton from './SaveTemplateButton';
import { ReactComponent as AlertIcon } from '../../assets/svg/alert_triangle.svg';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';
import {
  AccountState,
  Action,
  ActionCardOutput,
  calculateHypotheticalStates,
  UniswapPosition,
} from '../../data/actions/Actions';
import { Balances } from '../../data/Balances';
import { isSolvent } from '../../data/BalanceSheet';
import {
  RESPONSIVE_BREAKPOINT_MD,
  RESPONSIVE_BREAKPOINT_SM,
  RESPONSIVE_BREAKPOINT_XS,
} from '../../data/constants/Breakpoints';
import { MarginAccount } from '../../data/MarginAccount';
import { MarketInfo } from '../../data/MarketInfo';

const Wrapper = styled.div`
  ${tw`flex flex-col items-center justify-start`}
  background: ${GREY_800};
  border-radius: 8px;
  position: sticky;
  top: 117px;
  max-height: calc(100vh - 230px);
  overflow: hidden;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    top: 0;
    position: relative;
    max-height: 100%;
    overflow: visible;
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    width: 100%;
  }

  &:before {
    content: '';
    position: absolute;
    z-index: 1;
    inset: 0;
    pointer-events: none;
    border-radius: 8px;
    padding: 1.5px 1.5px 1.5px 1.5px;
    background: linear-gradient(90deg, #9baaf3 0%, #7bd8c0 100%);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  }
`;

const ScrollableContainer = styled.div`
  ${tw`flex flex-col items-start justify-start`}
  width: 100%;
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    border-radius: 16px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #6f6f6f;
    border-radius: 16px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: #4b4b4b;
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
  border: 2px solid ${GREY_800};
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

const ActionErrorContainer = styled.div`
  ${tw`w-full flex flex-row items-center justify-between gap-2`}
  background-color: rgba(255, 54, 69, 1);
  box-shadow: 0px 0px 10px rgba(255, 54, 69, 0.5);
  padding: 8px 16px;
  border-radius: 8px;
  margin-top: 32px;
  max-width: min-content;
  min-width: 100%;
`;

const StyledAlertIcon = styled(AlertIcon)`
  path {
    stroke: rgba(255, 54, 69, 1);
    fill: #ffff;
  }
`;

const StyledWarningIcon = styled(AlertIcon)`
  path {
    stroke: rgba(242, 201, 76, 1);
    fill: black;
  }
`;

const WarningContainer = styled.div`
  ${tw`flex flex-row items-center justify-between gap-2`}
  background-color: rgba(242, 201, 76, 1);
  padding: 8px 16px;
  border-radius: 8px;
  max-width: min-content;
  min-width: 100%;
`;

export type ManageAccountWidgetProps = {
  marketInfo: MarketInfo | null;
  marginAccount: MarginAccount;
  uniswapPositions: readonly UniswapPosition[];
  enabled: boolean;
  updateHypotheticalState: (state: AccountState | null) => void;
  onAddFirstAction: () => void;
};

export default function ManageAccountWidget(props: ManageAccountWidgetProps) {
  // MARK: component props
  const { marketInfo, marginAccount, uniswapPositions, enabled, updateHypotheticalState, onAddFirstAction } = props;
  const { address: accountAddress, token0, token1 } = marginAccount;

  const activeChain = useChain();

  // MARK: component state
  // actions
  const [userInputFields, setUserInputFields] = useState<(string[] | undefined)[]>([]);
  const [actionOutputs, setActionOutputs] = useState<ActionCardOutput[]>([]);
  const [activeActions, setActiveActions] = useState<Action[]>([]);
  const [hypotheticalStates, setHypotheticalStates] = useState<AccountState[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);
  // modals
  const [showAddActionModal, setShowAddActionModal] = useState(false);
  const actionCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    actionCardRefs.current = actionCardRefs.current.slice(0, activeActions.length);
  }, [activeActions]);

  // MARK: wagmi hooks
  const { address: userAddress } = useAccount();
  const { data: userBalance0Asset, refetch: refetchBalance0 } = useBalance({
    address: userAddress ?? '0x',
    token: token0.address,
    chainId: activeChain.id,
    query: { enabled: Boolean(userAddress) },
  });
  const { data: userBalance1Asset, refetch: refetchBalance1 } = useBalance({
    address: userAddress ?? '0x',
    token: token1.address,
    chainId: activeChain.id,
    query: { enabled: Boolean(userAddress) },
  });

  // MARK: logic to ensure that listed balances and MAXes work
  const userBalances: Balances = useMemo(
    () => ({
      amount0: userBalance0Asset ? GN.fromBigInt(userBalance0Asset.value, token0.decimals) : GN.zero(token0.decimals),
      amount1: userBalance1Asset ? GN.fromBigInt(userBalance1Asset.value, token1.decimals) : GN.zero(token1.decimals),
    }),
    [token0.decimals, token1.decimals, userBalance0Asset, userBalance1Asset]
  );

  const lenderBalances: Balances = useMemo(() => {
    return {
      amount0: marketInfo?.lender0AvailableAssets ?? GN.zero(token0.decimals),
      amount1: marketInfo?.lender1AvailableAssets ?? GN.zero(token1.decimals),
    };
  }, [marketInfo, token0, token1]);

  const initialState: AccountState = useMemo(
    () => ({
      assets: marginAccount.assets,
      liabilities: marginAccount.liabilities,
      uniswapPositions: uniswapPositions,
      availableForDeposit: userBalances,
      availableForBorrow: lenderBalances,
      requiredAllowances: { amount0: GN.zero(token0.decimals), amount1: GN.zero(token1.decimals) },
      claimedFeeUniswapKeys: [],
    }),
    [
      marginAccount.assets,
      marginAccount.liabilities,
      uniswapPositions,
      userBalances,
      lenderBalances,
      token0.decimals,
      token1.decimals,
    ]
  );

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    interval = setInterval(() => {
      refetchBalance0();
      refetchBalance1();
    }, 13_000);
    return () => {
      if (interval != null) {
        clearInterval(interval);
      }
    };
  }, [refetchBalance0, refetchBalance1]);

  useEffect(() => {
    const operators = actionOutputs.map((o) => o.operator);
    const { accountStates: states, errorMsg } = calculateHypotheticalStates(marginAccount, initialState, operators);
    setErrorMsg(errorMsg);
    setHypotheticalStates(states);
    updateHypotheticalState(states.length > 1 ? states[states.length - 1] : null);
  }, [actionOutputs, marginAccount, initialState, updateHypotheticalState]);

  const finalState = hypotheticalStates.at(hypotheticalStates.length - 1) ?? initialState;
  const numValidActions = hypotheticalStates.length - 1;
  const hasInvalidAction = activeActions.length > numValidActions && userInputFields.at(numValidActions) !== undefined;

  const { health } = isSolvent(
    finalState.assets,
    finalState.liabilities,
    finalState.uniswapPositions,
    marginAccount.sqrtPriceX96,
    marginAccount.iv,
    marginAccount.nSigma,
    token0.decimals,
    token1.decimals
  );

  if (marketInfo === null) return null;

  return (
    <Wrapper>
      <ScrollableContainer>
        <ActionCardWrapper>
          <Display size='M' weight='medium'>
            Manage Account
          </Display>
          <Text size='S' weight='medium'>
            Get started by clicking "Add Action" and add some collateral.
          </Text>
        </ActionCardWrapper>
        <ActionsList>
          {activeActions.map((action, index) => (
            <ActionItem key={index}>
              <ActionItemCount>
                <Text size='M' weight='bold' color={GREY_800}>
                  {index + 1}
                </Text>
              </ActionItemCount>
              <ActionCardWrapper ref={(el) => (actionCardRefs.current[index] = el)}>
                <action.actionCard
                  marketInfo={marketInfo}
                  marginAccount={marginAccount}
                  accountState={hypotheticalStates.at(index) ?? finalState}
                  userInputFields={userInputFields.at(index)}
                  isCausingError={index >= numValidActions && userInputFields.at(index) !== undefined}
                  errorMsg={index === numValidActions && userInputFields.at(index) !== undefined ? errorMsg : undefined}
                  forceOutput={actionOutputs.length === index}
                  onChange={(output: ActionCardOutput, userInputs: string[]) => {
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
              <Text size='M' weight='bold' color={GREY_800}>
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
                  if (enabled) {
                    setShowAddActionModal(true);
                  }
                }}
                disabled={!enabled}
              >
                Add Action
              </FilledGradientButtonWithIcon>
            </ActionCardWrapper>
          </ActionItem>
        </ActionsList>
        {hasInvalidAction && (
          <ActionErrorContainer>
            <div className='flex items-center justify-start gap-2'>
              <StyledAlertIcon width={24} height={24} />
              <Text size='M' weight='bold'>
                Invalid Action(s)
              </Text>
            </div>
            <Text size='S' weight='medium'>
              <button
                onClick={() => {
                  actionCardRefs.current[numValidActions]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                }}
                className='hover:underline'
              >
                View Problem
              </button>
            </Text>
          </ActionErrorContainer>
        )}
        <HealthBar health={health} />
        {health <= 1.001 && (
          <WarningContainer>
            <div>
              <StyledWarningIcon width={24} height={24} />
            </div>
            <div className='w-full flex flex-col'>
              <Text size='M' weight='bold' color='rgb(0, 0, 0)'>
                Warning
              </Text>
              <Text size='S' weight='medium' color='rgb(0, 0, 0)'>
                Your account is nearly unhealthy. Please proceed with caution.
              </Text>
            </div>
          </WarningContainer>
        )}
        <div className='w-full flex justify-between gap-4 mt-4'>
          <SaveTemplateButton activeActions={activeActions} userInputFields={userInputFields} />
          <ManageAccountTransactionButton
            userAddress={userAddress}
            accountAddress={accountAddress as Address}
            uniswapPool={marginAccount.uniswapPool}
            token0={token0}
            token1={token1}
            userBalances={userBalances}
            accountState={finalState}
            actionOutputs={actionOutputs}
            transactionWillFail={activeActions.length > numValidActions}
            enabled={enabled}
            onSuccessReceipt={() => {
              setActionOutputs([]);
              setUserInputFields([]);
              setActiveActions([]);
            }}
          />
        </div>
      </ScrollableContainer>
      <BorrowSelectActionModal
        isOpen={showAddActionModal && enabled}
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
