import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import {
  PreviousPageButton,
} from '../components/common/Buttons';
import { Display, Text } from '../components/common/Typography';
import { ReactComponent as BackArrowIcon } from '../assets/svg/back_arrow.svg';
import { FullscreenModal } from '../components/common/Modal';
import {
  Action,
  ActionCardResult,
  ActionProvider,
  ActionProviders,
  CumulativeActionCardResult,
  DEFAULT_ACTION_VALUE,
} from '../data/Actions';
import { FeeTier } from '../data/FeeTier';
import { GetTokenData } from '../data/TokenData';
import { useNavigate, useParams } from 'react-router-dom';
import MarginAccountHeader from '../components/borrow/MarginAccountHeader';
import { AccountStatsCard } from '../components/borrow/AccountStatsCard';
import PnLGraph from '../components/graph/PnLGraph';
import TokenAllocationPieChartWidget from '../components/borrow/TokenAllocationPieChartWidget';
import ManageAccountWidget from '../components/borrow/ManageAccountWidget';
import { RESPONSIVE_BREAKPOINT_MD } from '../data/constants/Breakpoints';
import UniswapAddLiquidityActionCard from '../components/borrow/actions/UniswapAddLiquidityActionCard';
import TokenChooser from '../components/common/TokenChooser';

export type MarginAccountBalances = {
  assets: number;
  liabilities: number;
  lowerLiquidationThreshold: number;
  upperLiquidationThreshold: number;
}

export type MarginAccount = {
  token0: MarginAccountBalances;
  token1: MarginAccountBalances;
}

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

function getAccount(account: string) {
  switch (account) {
    case '1234':
      return {
        token0: GetTokenData('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
        token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
        feeTier: FeeTier.ZERO_ZERO_FIVE,
      };
    case '5678':
      return {
        token0: GetTokenData('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'),
        token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
        feeTier: FeeTier.ZERO_ZERO_FIVE,
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

const FAKE_DATA: MarginAccount = {
  token0: {
    assets: 10,
    liabilities: 10,
    lowerLiquidationThreshold: 2000,
    upperLiquidationThreshold: Infinity,
  },
  token1: {
    assets: 50,
    liabilities: 50,
    lowerLiquidationThreshold: 1250,
    upperLiquidationThreshold: Infinity,
  },
};

export default function BorrowActionsPage() {
  const params = useParams<AccountParams>();
  const account = params.account;
  const accountData = getAccount(account || '');
  
  const [actionResults, setActionResults] = React.useState<Array<ActionCardResult>>([]);
  const [activeActions, setActiveActions] = React.useState<Array<Action>>([]);
  const [actionModalOpen, setActionModalOpen] = React.useState(false);
  const [isToken0Selected, setIsToken0Selected] = React.useState(false);
  const [cumulativeActionResult, setCumulativeActionResult] = React.useState<CumulativeActionCardResult | null>(null);
  const navigate = useNavigate();

  if (!accountData) {
    //If no account data is found, don't render the page
    return null;
  }

  const activeToken = isToken0Selected ? accountData.token0 : accountData.token1;
  const inactiveToken = isToken0Selected ? accountData.token1 : accountData.token0;
  const currentBalances = isToken0Selected ? FAKE_DATA.token0 : FAKE_DATA.token1;
  const combinedDeltaBalances: MarginAccount | null = cumulativeActionResult ? {
    token0: {
      assets: (cumulativeActionResult.aloeResult?.token0RawDelta.numericValue || 0) + 
              (cumulativeActionResult.aloeResult?.token0PlusDelta.numericValue || 0),
      liabilities: (cumulativeActionResult.aloeResult?.token0DebtDelta.numericValue || 0),
      lowerLiquidationThreshold: 0,
      upperLiquidationThreshold: 0,
    },
    token1: {
      assets: (cumulativeActionResult?.aloeResult?.token1RawDelta.numericValue || 0) +
              (cumulativeActionResult.aloeResult?.token1PlusDelta.numericValue || 0),
      liabilities: (cumulativeActionResult.aloeResult?.token1DebtDelta.numericValue || 0),
      lowerLiquidationThreshold: 0,
      upperLiquidationThreshold: 0,
    },
  } : null;
  const activeDeltaBalances: MarginAccountBalances | null = combinedDeltaBalances ? (isToken0Selected ? combinedDeltaBalances.token0 : combinedDeltaBalances.token1) : null;
  const hypotheticalActiveAssets: number | null = activeDeltaBalances ? currentBalances.assets + activeDeltaBalances.assets : null;
  const hypotheticalActiveLiabilities: number | null = activeDeltaBalances ? currentBalances.liabilities + activeDeltaBalances.liabilities : null;

  function handleAddAction(action: Action) {
    setActionResults([...actionResults, {
      aloeResult: null,
      uniswapResult: null,
    }]);
    setActiveActions([...activeActions, action]);
  }

  function updateCumulativeActionResult(updatedActionResults: ActionCardResult[]) {
    let updatedCumulativeActionResult: CumulativeActionCardResult = {
      aloeResult: {
        selectedTokenA: null,
        token0RawDelta: DEFAULT_ACTION_VALUE,
        token0DebtDelta: DEFAULT_ACTION_VALUE,
        token0PlusDelta: DEFAULT_ACTION_VALUE,
        token1RawDelta: DEFAULT_ACTION_VALUE,
        token1DebtDelta: DEFAULT_ACTION_VALUE,
        token1PlusDelta: DEFAULT_ACTION_VALUE,
      },
      uniswapPositions: [],
    }
    for (let actionResult of updatedActionResults) {
      const aloeResult = actionResult.aloeResult;
      const uniswapPosition = actionResult.uniswapResult?.uniswapPosition;
      if (aloeResult) {
        updatedCumulativeActionResult = {
          aloeResult: {
            selectedTokenA: null,
            token0RawDelta: {
              inputValue: '',
              numericValue: (updatedCumulativeActionResult.aloeResult?.token0RawDelta.numericValue || 0) + aloeResult.token0RawDelta.numericValue,
            },
            token0DebtDelta: {
              inputValue: '',
              numericValue: (updatedCumulativeActionResult.aloeResult?.token0DebtDelta.numericValue || 0) + aloeResult.token0DebtDelta.numericValue,
            },
            token0PlusDelta: {
              inputValue: '',
              numericValue: (updatedCumulativeActionResult.aloeResult?.token0PlusDelta.numericValue || 0) + aloeResult.token0PlusDelta.numericValue,
            },
            token1RawDelta: {
              inputValue: '',
              numericValue: (updatedCumulativeActionResult.aloeResult?.token1RawDelta.numericValue || 0) + aloeResult.token1RawDelta.numericValue,
            },
            token1DebtDelta: {
              inputValue: '',
              numericValue: (updatedCumulativeActionResult.aloeResult?.token1DebtDelta.numericValue || 0) + aloeResult.token1DebtDelta.numericValue,
            },
            token1PlusDelta: {
              inputValue: '',
              numericValue: (updatedCumulativeActionResult.aloeResult?.token1PlusDelta.numericValue || 0) + aloeResult.token1PlusDelta.numericValue,
            },
          },
          uniswapPositions: updatedCumulativeActionResult.uniswapPositions,
        }
      } else if (uniswapPosition && uniswapPosition.lowerBound != null && uniswapPosition.upperBound != null) {
        const existingPositionIndex = updatedCumulativeActionResult.uniswapPositions.findIndex((pos) => {
          return pos.lowerBound === uniswapPosition.lowerBound && pos.upperBound === uniswapPosition.upperBound;
        });

        if (existingPositionIndex !== -1) {
          const existingPosition = updatedCumulativeActionResult.uniswapPositions[existingPositionIndex];
          updatedCumulativeActionResult.uniswapPositions[existingPositionIndex] = {
            amount0: {
              inputValue: '',
              numericValue: existingPosition.amount0.numericValue + uniswapPosition.amount0.numericValue,
            },
            amount1: {
              inputValue: '',
              numericValue: existingPosition.amount1.numericValue + uniswapPosition.amount1.numericValue,
            },
            lowerBound: existingPosition.lowerBound,
            upperBound: existingPosition.upperBound,
          }
        } else {
          updatedCumulativeActionResult = {
            aloeResult: updatedCumulativeActionResult.aloeResult,
            uniswapPositions: [...updatedCumulativeActionResult.uniswapPositions, uniswapPosition],
          }
        }
      }
    }
    console.log(cumulativeActionResult);
    console.log(updatedActionResults);
    setCumulativeActionResult(updatedCumulativeActionResult);
  }

  function updateActionResults(updatedActionResults: ActionCardResult[]) {
    setActionResults(updatedActionResults);
    updateCumulativeActionResult(updatedActionResults);
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
            feeTier={accountData.feeTier}
            activeActions={activeActions}
            actionResults={actionResults}
            updateActionResults={updateActionResults}
            onAddAction={() => {
              setActionModalOpen(true);
            }}
            onRemoveAction={(index: number) => {
              let actionResultsCopy = [...actionResults];
              const updatedActionResults = actionResultsCopy.filter((_, i) => i !== index);
              setActionResults(updatedActionResults);
              updateCumulativeActionResult(updatedActionResults);
              let activeActionsCopy = [...activeActions];
              setActiveActions(activeActionsCopy.filter((_, i) => i !== index));
            }}
          />
        </GridExpandingDiv>
        <div className='w-full flex flex-col justify-between'>
          <div className='w-full flex flex-col gap-4 mb-8'>
            <div className='flex gap-4 items-center'>
              <Display size='M' weight='medium'>
                Summary
              </Display>
              <TokenChooser
                token0={accountData.token0}
                token1={accountData.token1}
                isToken0Selected={isToken0Selected}
                setIsToken0Selected={setIsToken0Selected}
              />
            </div>
            <AccountStatsGrid>
              <AccountStatsCard
                label='Assets'
                value={`${currentBalances.assets} ${activeToken?.ticker || ''}`}
                hypothetical={hypotheticalActiveAssets != null && (hypotheticalActiveAssets !== currentBalances.assets) ? `${hypotheticalActiveAssets} ${activeToken?.ticker || ''}` : undefined}
              />
              <AccountStatsCard
                label='Liabilities'
                value={`${currentBalances.liabilities} ${activeToken?.ticker || ''}`}
                hypothetical={hypotheticalActiveAssets != null && (hypotheticalActiveLiabilities !== currentBalances.liabilities) ? `${hypotheticalActiveLiabilities} ${activeToken?.ticker || ''}` : undefined}
              />
              <AccountStatsCard
                label='Lower Liquidation Threshold'
                value={`${currentBalances.lowerLiquidationThreshold} ${activeToken?.ticker || ''}/${
                  inactiveToken?.ticker || ''
                }`}
                hypothetical={undefined}
              />
              <AccountStatsCard
                label='Upper Liquidation Threshold'
                value={`${currentBalances.upperLiquidationThreshold} ${activeToken?.ticker || ''}/${
                  inactiveToken?.ticker || ''
                }`}
                hypothetical={undefined}
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
            {Object.values(ActionProviders).map(
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
