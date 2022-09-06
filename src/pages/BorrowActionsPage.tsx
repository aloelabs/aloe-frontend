import React, { useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import { PreviousPageButton } from '../components/common/Buttons';
import { Display, Text } from '../components/common/Typography';
import { ReactComponent as BackArrowIcon } from '../assets/svg/back_arrow.svg';
import { FullscreenModal } from '../components/common/Modal';
import {
  Action,
  ActionCardState,
  ActionProvider,
  ActionProviders,
  ActionTemplates,
  CumulativeActionCardResult,
  getNameOfAction,
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
import TokenChooser from '../components/common/TokenChooser';
import { sumOfAssetsUsedForUniswapPositions } from '../util/Uniswap';
import { ReactComponent as LayersIcon } from '../assets/svg/layers.svg';
import JSBI from 'jsbi';
import { useContract, useProvider } from 'wagmi';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import useEffectOnce from '../data/hooks/UseEffectOnce';
import { Assets, Liabilities, MarginAccount, sumAssetsPerToken } from '../data/MarginAccount';
import Big from 'big.js';
import { BigNumber } from 'ethers';

// export type MarginAccountBalances = {
//   assets: number;
//   liabilities: number;
//   lowerLiquidationThreshold: number;
//   upperLiquidationThreshold: number;
// }

// export type MarginAccount = {
//   token0: MarginAccountBalances;
//   token1: MarginAccountBalances;
// }

export type CumulativeBalance = {
  assets: number;
  liabilities: number;
  lowerLiquidationThreshold: number;
  upperLiquidationThreshold: number;
};

// export type CumulativeBalances = {
//   token0: CumulativeBalance;
//   token1: CumulativeBalance;
// }

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

function getAccount(account: string) {
  switch (account) {
    case '1234':
      return {
        token0: GetTokenData('0x3c80ca907ee39f6c3021b66b5a55ccc18e07141a'),
        token1: GetTokenData('0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6'),
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
  grid-row: 1 / 4;
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

const BackButtonWrapper = styled.button.attrs((props: { position?: string }) => props)`
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

const TemplatesSvgWrapper = styled.div`
  ${tw`flex items-center justify-center`}
  width: 32px;
  height: 32px;

  svg {
    path {
      stroke: #4b6980;
    }
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

const ActionButton = styled.button.attrs((props: { borderColor: string }) => props)`
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
  const [marginAccount, setMarginAccount] = useState<MarginAccount | null>(null);
  // const accountData = getAccount(account || '');
  const provider = useProvider();
  const marginAccountLensContract = useContract({
    addressOrName: '0xFc9A50F2dD9348B5a9b00A21B09D9988bd9726F7',
    contractInterface: MarginAccountLensABI,
    signerOrProvider: provider,
  });

  useEffectOnce(() => {
    let mounted = true;
    async function fetch(address: string) {
      const token0Address = '0x3c80ca907ee39f6c3021b66b5a55ccc18e07141a';
      const token1Address = '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6';
      const token0 = GetTokenData(token0Address);
      const token1 = GetTokenData(token1Address);
      const feeTier = FeeTier.ZERO_ZERO_FIVE;
      const assetsData: BigNumber[] = await marginAccountLensContract.getAssets(address);
      const liabilitiesData: BigNumber[] = await marginAccountLensContract.getLiabilities(address);
      const assets: Assets = {
        token0Raw: Big(assetsData[0].toString())
          .div(10 ** token0.decimals)
          .toNumber(),
        token1Raw: Big(assetsData[1].toString())
          .div(10 ** token1.decimals)
          .toNumber(),
        token0Plus: Big(assetsData[2].toString())
          .div(10 ** token0.decimals)
          .toNumber(),
        token1Plus: Big(assetsData[3].toString())
          .div(10 ** token1.decimals)
          .toNumber(),
        uni0: Big(assetsData[4].toString())
          .div(10 ** token0.decimals)
          .toNumber(),
        uni1: Big(assetsData[5].toString())
          .div(10 ** token1.decimals)
          .toNumber(),
      };
      const liabilities: Liabilities = {
        amount0: Big(liabilitiesData[0].toString())
          .div(10 ** token0.decimals)
          .toNumber(),
        amount1: Big(liabilitiesData[1].toString())
          .div(10 ** token1.decimals)
          .toNumber(),
      };
      if (mounted) {
        setMarginAccount({
          address: address,
          assets: assets,
          feeTier: feeTier,
          liabilities: liabilities,
          token0: token0,
          token1: token1,
        });
      }
    }
    if (account) {
      fetch(account);
    }
    return () => {
      mounted = false;
    };
  });

  const [actionResults, setActionResults] = React.useState<Array<ActionCardState>>([]);
  const [activeActions, setActiveActions] = React.useState<Array<Action>>([]);
  const [actionModalOpen, setActionModalOpen] = React.useState(false);
  const [isToken0Selected, setIsToken0Selected] = React.useState(false);
  const [cumulativeActionResult, setCumulativeActionResult] = React.useState<CumulativeActionCardResult | null>(null);
  const navigate = useNavigate();

  if (!marginAccount) {
    //If no account data is found, don't render the page
    return null;
  }

  const assetsInUniswapPositions: [number, number] = cumulativeActionResult
    ? sumOfAssetsUsedForUniswapPositions(cumulativeActionResult.uniswapPositions)
    : [0, 0];
  const activeToken = isToken0Selected ? marginAccount.token0 : marginAccount.token1;
  const inactiveToken = isToken0Selected ? marginAccount.token1 : marginAccount.token0;
  const currentAssetsPerToken = marginAccount ? sumAssetsPerToken(marginAccount.assets) : [0, 0];
  const currentBalancesPerToken: [CumulativeBalance, CumulativeBalance] = [
    {
      assets: currentAssetsPerToken[0],
      liabilities: marginAccount.liabilities.amount0,
      lowerLiquidationThreshold: 0,
      upperLiquidationThreshold: 0,
    },
    {
      assets: currentAssetsPerToken[1],
      liabilities: marginAccount.liabilities.amount1,
      lowerLiquidationThreshold: 0,
      upperLiquidationThreshold: 0,
    },
  ];
  const currentBalances: CumulativeBalance = currentBalancesPerToken[isToken0Selected ? 0 : 1];
  const combinedDeltaBalances: [CumulativeBalance, CumulativeBalance] | null = cumulativeActionResult
    ? [
        {
          assets:
            (cumulativeActionResult.aloeResult?.token0RawDelta || 0) +
            (cumulativeActionResult.aloeResult?.token0PlusDelta || 0) +
            assetsInUniswapPositions[0],
          liabilities: cumulativeActionResult.aloeResult?.token0DebtDelta || 0,
          lowerLiquidationThreshold: 0,
          upperLiquidationThreshold: 0,
        },
        {
          assets:
            (cumulativeActionResult?.aloeResult?.token1RawDelta || 0) +
            (cumulativeActionResult.aloeResult?.token1PlusDelta || 0) +
            assetsInUniswapPositions[1],
          liabilities: cumulativeActionResult.aloeResult?.token1DebtDelta || 0,
          lowerLiquidationThreshold: 0,
          upperLiquidationThreshold: 0,
        },
      ]
    : null;
  const activeDeltaBalances: CumulativeBalance | null = combinedDeltaBalances
    ? isToken0Selected
      ? combinedDeltaBalances[0]
      : combinedDeltaBalances[1]
    : null;
  const hypotheticalActiveAssets: number | null = activeDeltaBalances ? currentBalances.assets + activeDeltaBalances.assets : null;
  const hypotheticalActiveLiabilities: number | null = activeDeltaBalances ? currentBalances.liabilities + activeDeltaBalances.liabilities : null;

  function updateCumulativeActionResult(updatedActionResults: ActionCardState[]) {
    let updatedCumulativeActionResult: CumulativeActionCardResult = {
      aloeResult: {
        selectedToken: null,
      },
      uniswapPositions: [],
    };
    for (let actionResult of updatedActionResults) {
      const aloeResult = actionResult.aloeResult;
      const uniswapPosition = actionResult.uniswapResult?.uniswapPosition;
      if (aloeResult) {
        updatedCumulativeActionResult = {
          aloeResult: {
            selectedToken: null,
            token0RawDelta:
              (updatedCumulativeActionResult.aloeResult?.token0RawDelta || 0) + (aloeResult.token0RawDelta ?? 0),
            token0DebtDelta:
              (updatedCumulativeActionResult.aloeResult?.token0DebtDelta || 0) + (aloeResult.token0DebtDelta ?? 0),
            token0PlusDelta:
              (updatedCumulativeActionResult.aloeResult?.token0PlusDelta || 0) + (aloeResult.token0PlusDelta ?? 0),
            token1RawDelta:
              (updatedCumulativeActionResult.aloeResult?.token1RawDelta || 0) + (aloeResult.token1RawDelta ?? 0),
            token1DebtDelta:
              (updatedCumulativeActionResult.aloeResult?.token1DebtDelta || 0) + (aloeResult.token1DebtDelta ?? 0),
            token1PlusDelta:
              (updatedCumulativeActionResult.aloeResult?.token1PlusDelta || 0) + (aloeResult.token1PlusDelta ?? 0),
          },
          uniswapPositions: updatedCumulativeActionResult.uniswapPositions,
        };
      }
      if (uniswapPosition && uniswapPosition.lowerBound != null && uniswapPosition.upperBound != null) {
        const existingPositionIndex = updatedCumulativeActionResult.uniswapPositions.findIndex((pos) => {
          return pos.lowerBound === uniswapPosition.lowerBound && pos.upperBound === uniswapPosition.upperBound;
        });

        if (existingPositionIndex !== -1) {
          const existingPosition = updatedCumulativeActionResult.uniswapPositions[existingPositionIndex];
          updatedCumulativeActionResult.uniswapPositions[existingPositionIndex] = {
            liquidity: JSBI.BigInt(0),
            amount0: existingPosition.amount0 + uniswapPosition.amount0,
            amount1: existingPosition.amount1 + uniswapPosition.amount1,
            lowerBound: existingPosition.lowerBound,
            upperBound: existingPosition.upperBound,
          };
        } else {
          updatedCumulativeActionResult = {
            aloeResult: updatedCumulativeActionResult.aloeResult,
            uniswapPositions: [...updatedCumulativeActionResult.uniswapPositions, uniswapPosition],
          };
        }
      }
    }
    console.log(cumulativeActionResult);
    console.log(updatedActionResults);
    setCumulativeActionResult(updatedCumulativeActionResult);
  }

  function updateActionResults(updatedActionResults: ActionCardState[]) {
    setActionResults(updatedActionResults);
    updateCumulativeActionResult(updatedActionResults);
  }

  function handleAddAction(action: Action) {
    updateActionResults([
      ...actionResults,
      {
        actionId: action.id,
        aloeResult: null,
        uniswapResult: null,
      },
    ]);
    setActiveActions([...activeActions, action]);
  }

  function handleAddActions(actions: Action[], defaultActionResults?: ActionCardState[]) {
    if (defaultActionResults && actions.length !== defaultActionResults.length) {
      console.error(
        'You must pass in the same number of action results as you do actions (or pass no action results in).'
      );
      return;
    }
    const newActionResults =
      defaultActionResults ||
      actions.map((x) => {
        return {
          actionId: x.id,
          aloeResult: null,
          uniswapResult: null,
        };
      });
    updateActionResults([...actionResults, ...newActionResults]);
    setActiveActions([...activeActions, ...actions]);
  }

  return (
    <AppPage>
      <BodyWrapper>
        <div className='flex gap-8 items-center mb-4'>
          <PreviousPageButton onClick={() => navigate('../borrow')} />
          <MarginAccountHeader
            token0={marginAccount.token0}
            token1={marginAccount.token1}
            feeTier={marginAccount.feeTier}
            id={account || ''}
          />
        </div>
        <GridExpandingDiv>
          <ManageAccountWidget
            token0={marginAccount.token0}
            token1={marginAccount.token1}
            feeTier={marginAccount.feeTier}
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
                token0={marginAccount.token0}
                token1={marginAccount.token1}
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
            <PnLGraph />
          </div>
          <div className='w-full flex flex-col gap-4'>
            <Display size='M' weight='medium'>
              Token Allocation
            </Display>
            <TokenAllocationPieChartWidget token0={marginAccount.token0} token1={marginAccount.token1} />
          </div>
        </div>
      </BodyWrapper>
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
          {Object.values(ActionProviders).map((actionProvider: ActionProvider, index: number) => {
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
                  {Object.entries(actionProvider.actions).map((actionData, index) => {
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
                          {getNameOfAction(action.id)}
                        </Text>
                      </ActionButton>
                    );
                  })}
                </ActionButtonsContainer>
              </ActionProviderContainer>
            );
          })}
          <ActionProviderContainer>
            <div className='flex items-center mb-4'>
              <TemplatesSvgWrapper>
                <LayersIcon width={20} height={20} />
              </TemplatesSvgWrapper>
              <Display size='M' weight='semibold'>
                Templates
              </Display>
            </div>
            <ActionButtonsContainer>
              {Object.entries(ActionTemplates).map((templateData, index) => {
                const template = templateData[1];
                return (
                  <ActionButton
                    key={index}
                    borderColor='#4B6980'
                    onClick={() => {
                      handleAddActions(template.actions, template.defaultActionStates);
                      setActionModalOpen(false);
                    }}
                  >
                    {template.name}
                  </ActionButton>
                );
              })}
            </ActionButtonsContainer>
          </ActionProviderContainer>
        </div>
      </FullscreenModal>
    </AppPage>
  );
}
