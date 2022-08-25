import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import {
  PreviousPageButton,
} from '../components/common/Buttons';
import { Display, Text } from '../components/common/Typography';
import { ReactComponent as BackArrowIcon } from '../assets/svg/back_arrow.svg';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import { FullscreenModal } from '../components/common/Modal';
import {
  Action,
  ActionCardResult,
  ActionProvider,
  Actions,
} from '../data/Actions';
import { FeeTier } from '../data/BlendPoolMarkers';
import { GetTokenData } from '../data/TokenData';
import { useNavigate, useParams } from 'react-router-dom';
import MarginAccountHeader from '../components/borrow/MarginAccountHeader';
import { AccountStatsCard } from '../components/borrow/AccountStatsCard';
import PnLGraph from '../components/graph/PnLGraph';
import TokenAllocationPieChartWidget from '../components/borrow/TokenAllocationPieChartWidget';
import ManageAccountWidget from '../components/borrow/ManageAccountWidget';
import { RESPONSIVE_BREAKPOINT_MD } from '../data/constants/Breakpoints';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

function getAccount(account: string) {
  switch (account) {
    case '1234':
      return {
        token0: GetTokenData('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
        token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
        feeTier: FeeTier.ZERO_THREE,
      };
    default:
      return null;
  }
}

type AccountParams = {
  account: string;
};

const BodyWrapper = styled.div`
  display: grid;
  width: 100%;
  grid-template-columns: calc(100% - 582px) 550px;
  gap: 32px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    grid-template-columns: 1fr;
  }
`;

const GridExpandingDiv = styled.div`
  grid-row: 1 / span 2;
  grid-column: 2 / span 1;
  justify-self: center;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    justify-self: start;
    grid-row: 2 / span 1;
    grid-column: 1 / span 1;
  }
`;

const ActionModalHeader = styled.div`
  ${tw`flex justify-center items-center`}
  position: relative;
  margin-bottom: 24px;
`;

const BackButtonWrapper = styled.button.attrs(
  (props: { position?: string }) => props
)`
  ${tw`flex items-center justify-center`}
  position: ${(props) => props.position || 'absolute'};
  left: 0;

  svg {
    width: 40px;
    height: 40px;
    path {
      stroke: ${SECONDARY_COLOR};
    }
  }

  &:hover {
    svg {
      path {
        stroke: rgb(255, 255, 255);
      }
    }
  }
`;

const SvgWrapper = styled.div`
  ${tw`flex items-center justify-center`}
  width: 32px;
  height: 32px;

  svg {
    width: 32px;
    height: 32px;
  }
`;

const ActionProviderContainer = styled.div`
  ${tw`flex flex-col items-start justify-center`}
  margin: 0 auto;
  width: 100%;
  max-width: 800px;
  margin-bottom: 16px;

  @media (max-width: 864px) {
    max-width: 525px;
  }
`;

const ActionButtonsContainer = styled.div`
  ${tw`w-full flex flex-wrap items-center`}
  gap: 25px;
`;

const ActionButton = styled.button.attrs(
  (props: { borderColor: string }) => props
)`
  ${tw`flex items-center justify-center`}
  width: 250px;
  padding: 12px 8px;
  border-radius: 8px;
  border: 1px solid ${(props) => props.borderColor};
  background-color: rgba(13, 24, 33, 1);

  &:hover {
    background-color: ${(props) => props.borderColor};
  }

  @media (max-width: 589px) {
    width: 100%;
  }
`;

const AccountStatsGrid = styled.div`
  display: grid;
  //TODO: make this responsive
  grid-template-columns: 1fr 1fr;
  gap: 16px;
`;

export default function BorrowActionsPage() {
  const params = useParams<AccountParams>();
  const account = params.account;
  const accountData = getAccount(account || '');
  const [actionResults, setActionResults] = React.useState<ActionCardResult[]>([]);
  const [activeActions, setActiveActions] = React.useState<Array<Action>>([]);
  const [actionModalOpen, setActionModalOpen] = React.useState(false);
  const navigate = useNavigate();
  if (!accountData) {
    //If no account data is found, don't render the page
    return null;
  }
  function handleAddAction(action: Action) {
    setActionResults([...actionResults, { 
      token0RawDelta: {
        numericValue: 0,
        inputValue: '',
      },
      token1RawDelta: {
        numericValue: 0,
        inputValue: '',
      },
      token0DebtDelta: {
        numericValue: 0,
        inputValue: '',
      },
      token1DebtDelta: {
        numericValue: 0,
        inputValue: '',
      },
      token0PlusDelta: {
        numericValue: 0,
        inputValue: '',
      },
      token1PlusDelta: {
        numericValue: 0,
        inputValue: '',
      },
      uniswapPositions: [],
      selectedTokenA: null,
      selectedTokenB: null,
     }]);
    setActiveActions([...activeActions, action]);
  }
  return (
    <AppPage>
      <BodyWrapper>
        <div className='flex gap-8 items-center mb-4'>
          <PreviousPageButton onClick={() => navigate('../borrow')} />
          <MarginAccountHeader
            token0={accountData.token0}
            token1={accountData.token1}
            feeTier={accountData.feeTier}
            id={account || ''}
          />
        </div>
        <GridExpandingDiv>
          <ManageAccountWidget
            token0={accountData.token0}
            token1={accountData.token1}
            activeActions={activeActions}
            actionResults={actionResults}
            setActionResults={setActionResults}
            onAddAction={() => {
              setActionModalOpen(true);
            }}
            onRemoveAction={(index: number) => {
              let actionResultsCopy = [...actionResults];
              setActionResults(actionResultsCopy.filter((_, i) => i !== index));
              let activeActionsCopy = [...activeActions];
              setActiveActions(activeActionsCopy.filter((_, i) => i !== index));
            }}
          />
        </GridExpandingDiv>
        <div className='w-full flex flex-col justify-between'>
          <div className='w-full flex flex-col gap-4 mb-8'>
            <Display size='M' weight='medium'>
              Summary
            </Display>
            <AccountStatsGrid>
              <AccountStatsCard
                label='Assets'
                value={`1100 ${accountData.token0?.ticker || ''}`}
              />
              <AccountStatsCard
                label='Liabilities'
                value={`500 ${accountData.token0?.ticker || ''}`}
              />
              <AccountStatsCard
                label='Lower Liquidation Threshold'
                value={`2000 ${accountData.token0?.ticker || ''}/${
                  accountData.token1?.ticker || ''
                }`}
              />
              <AccountStatsCard
                label='Upper Liquidation Threshold'
                value={`∞ ${accountData.token0?.ticker || ''}/${
                  accountData.token1?.ticker || ''
                }`}
              />
            </AccountStatsGrid>
          </div>
          <div className='w-full flex flex-col gap-4'>
            <Display size='M' weight='medium'>
              PnL
            </Display>
            <div className='w-full h-52 mb-4'>
              {/* TODO: Don't hardcode height in className */}
              <PnLGraph />
            </div>
          </div>
          <div className='w-full flex flex-col gap-4'>
            <Display size='M' weight='medium'>
              Token Allocation
            </Display>
            <TokenAllocationPieChartWidget
              token0={accountData.token0}
              token1={accountData.token1}
            />
          </div>
        </div>
        <FullscreenModal
          open={actionModalOpen}
          setOpen={(open: boolean) => {
            setActionModalOpen(open);
          }}
        >
          <ActionModalHeader>
            <BackButtonWrapper>
              <BackArrowIcon
                onClick={() => {
                  setActionModalOpen(false);
                }}
              />
            </BackButtonWrapper>
            <Display size='M' weight='medium'>
              New Action
            </Display>
          </ActionModalHeader>
          <div className='flex flex-col gap-4'>
            {Object.values(Actions).map(
              (actionProvider: ActionProvider, index: number) => {
                return (
                  <ActionProviderContainer key={index}>
                    <div className='flex items-center mb-4'>
                      <SvgWrapper>
                        <actionProvider.Icon />
                      </SvgWrapper>
                      <Display size='M' weight='semibold'>
                        {actionProvider.name}
                      </Display>
                    </div>
                    <ActionButtonsContainer>
                      {Object.entries(actionProvider.actions).map(
                        (actionData, index) => {
                          const action = actionData[1];
                          return (
                            <ActionButton
                              key={index}
                              borderColor={actionProvider.color}
                              onClick={() => {
                                handleAddAction(action);
                                setActionModalOpen(false);
                              }}
                            >
                              <Text size='S' weight='bold'>
                                {action.name}
                              </Text>
                            </ActionButton>
                          );
                        }
                      )}
                    </ActionButtonsContainer>
                  </ActionProviderContainer>
                );
              }
            )}
          </div>
        </FullscreenModal>
      </BodyWrapper>
    </AppPage>
  );
}
