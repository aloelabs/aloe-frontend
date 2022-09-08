import React, { useEffect, useState } from 'react';
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
import { FeeTier, NumericFeeTierToEnum } from '../data/FeeTier';
import { GetTokenData, TokenData } from '../data/TokenData';
import { useNavigate, useParams } from 'react-router-dom';
import MarginAccountHeader from '../components/borrow/MarginAccountHeader';
import { AccountStatsCard } from '../components/borrow/AccountStatsCard';
import PnLGraph from '../components/graph/PnLGraph';
import TokenAllocationPieChartWidget from '../components/borrow/TokenAllocationPieChartWidget';
import ManageAccountWidget from '../components/borrow/ManageAccountWidget';
import { RESPONSIVE_BREAKPOINT_MD } from '../data/constants/Breakpoints';
import TokenChooser from '../components/common/TokenChooser';
import { Q96, sumOfAssetsUsedForUniswapPositions } from '../util/Uniswap';
import { ReactComponent as LayersIcon } from '../assets/svg/layers.svg';
import JSBI from 'jsbi';
import { useAccount, useContract, useProvider } from 'wagmi';
import useEffectOnce from '../data/hooks/UseEffectOnce';
import { Assets, Liabilities, MarginAccount, sumAssetsPerToken } from '../data/MarginAccount';
import Big from 'big.js';
import { BigNumber, ethers } from 'ethers';
import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { HypotheticalToggleButton } from '../components/borrow/HypotheticalToggleButton';

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

const q96 = new Big(Q96.toString());

function isSolvent(
  assets: Assets,
  liabilities: Liabilities,
  sqrtPriceX96: Big,
  token0: TokenData,
  token1: TokenData
): boolean {
  const priceX96 = sqrtPriceX96.mul(sqrtPriceX96).div(q96);

  const assets0 = assets.token0Raw + assets.token0Plus + assets.uni0;
  const assets1 = assets.token1Raw + assets.token1Plus + assets.uni1;

  const assets_1 =
    assets1 +
    priceX96
      .mul(assets0)
      .mul(10 ** token0.decimals)
      .div(q96)
      .div(10 ** token1.decimals)
      .toNumber();
  const liabilities_1 =
    liabilities.amount1 +
    priceX96
      .mul(liabilities.amount0)
      .mul(10 ** token0.decimals)
      .div(q96)
      .div(10 ** token1.decimals)
      .toNumber();

  return assets_1 >= 1.08 * liabilities_1;
}

function inTermsOfEachToken(
  amount0: number,
  amount1: number,
  sqrtPriceX96: Big,
  token0: TokenData,
  token1: TokenData
): [number, number] {
  const priceX96 = sqrtPriceX96.mul(sqrtPriceX96).div(q96);

  const inTermsOfToken1 =
    amount1 +
    priceX96
      .mul(amount0)
      .mul(10 ** token0.decimals)
      .div(q96)
      .div(10 ** token1.decimals)
      .toNumber();
  const inTermsOfToken0 =
    amount0 +
    q96
      .mul(amount1)
      .mul(10 ** token1.decimals)
      .div(priceX96)
      .div(10 ** token0.decimals)
      .toNumber();

  return [inTermsOfToken0, inTermsOfToken1];
}

export default function BorrowActionsPage() {
  const navigate = useNavigate();
  const params = useParams<AccountParams>();
  const accountAddressParam = params.account;

  // MARK: component state
  const [isShowingHypothetical, setIsShowingHypothetical] = useState<boolean>(false);
  const [marginAccount, setMarginAccount] = useState<MarginAccount | null>(null);
  const [actionResults, setActionResults] = useState<ActionCardState[]>([]);
  const [activeActions, setActiveActions] = useState<Action[]>([]);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [isToken0Selected, setIsToken0Selected] = useState(false);
  const [sqrtPriceX96, setSqrtPriceX96] = useState<Big | null>(null);

  // MARK: wagmi hooks
  const provider = useProvider();
  // const { address } = useAccount();
  const marginAccountContract = useContract({
    addressOrName: accountAddressParam ?? '', // TODO better optional resolution
    contractInterface: MarginAccountABI,
    signerOrProvider: provider,
  });
  const marginAccountLensContract = useContract({
    addressOrName: '0xFc9A50F2dD9348B5a9b00A21B09D9988bd9726F7',
    contractInterface: MarginAccountLensABI,
    signerOrProvider: provider,
  });

  useEffect(() => {
    let mounted = true;
    async function fetch(marginAccountAddress: string) {
      const results = await Promise.all([
        marginAccountContract.TOKEN0(),
        marginAccountContract.TOKEN1(),
        marginAccountContract.UNISWAP_POOL(),
        marginAccountLensContract.getAssets(marginAccountAddress),
        await marginAccountLensContract.getLiabilities(marginAccountAddress),
      ]);

      const uniswapPool = results[2];
      const uniswapPoolContract = new ethers.Contract(uniswapPool, UniswapV3PoolABI, provider);
      const [feeTier, slot0] = await Promise.all([uniswapPoolContract.fee(), uniswapPoolContract.slot0()]);

      const token0 = GetTokenData(results[0] as string);
      const token1 = GetTokenData(results[1] as string);
      const assetsData = results[3] as BigNumber[];
      const liabilitiesData = results[4] as BigNumber[];

      const assets: Assets = {
        token0Raw: Big(assetsData[0].toString())
          .div(10 ** token0.decimals)
          .toNumber(),
        token1Raw: Big(assetsData[1].toString())
          .div(10 ** token1.decimals)
          .toNumber(),
        token0Plus: Big(assetsData[2].toString())
          .div(10 ** 18)
          .toNumber(),
        token1Plus: Big(assetsData[3].toString())
          .div(10 ** 18)
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
          address: marginAccountAddress,
          token0: token0,
          token1: token1,
          feeTier: NumericFeeTierToEnum(feeTier),
          assets: assets,
          liabilities: liabilities,
        });
        setSqrtPriceX96(new Big(slot0.sqrtPriceX96.toString()));
      }
    }
    if (accountAddressParam) {
      fetch(accountAddressParam);
    }
    return () => {
      mounted = false;
    };
  }, [provider]);

  if (!marginAccount) {
    //If no account data is found, don't render the page
    return null;
  }

  // assets and liabilities before adding any hypothetical actions
  const assetsI = marginAccount.assets;
  const liabilitiesI = marginAccount.liabilities;

  // assets and liabilities after adding hypothetical actions
  let assetsF = { ...assetsI };
  let liabilitiesF = { ...liabilitiesI };
  let problematicActionIdx: number | null = null;

  for (let i = 0; i < actionResults.length; i += 1) {
    const actionResult = actionResults[i];

    const assetsTemp = { ...assetsF };
    const liabilitiesTemp = { ...liabilitiesF };

    // update assets
    assetsTemp.token0Raw += actionResult.aloeResult?.token0RawDelta ?? 0;
    assetsTemp.token1Raw += actionResult.aloeResult?.token1RawDelta ?? 0;
    assetsTemp.token0Plus += actionResult.aloeResult?.token0PlusDelta ?? 0;
    assetsTemp.token1Plus += actionResult.aloeResult?.token1PlusDelta ?? 0;
    assetsTemp.uni0 += actionResult.uniswapResult?.uniswapPosition.amount0 ?? 0;
    assetsTemp.uni1 += actionResult.uniswapResult?.uniswapPosition.amount1 ?? 0;

    // update liabilities
    liabilitiesTemp.amount0 += actionResult.aloeResult?.token0DebtDelta ?? 0;
    liabilitiesTemp.amount1 += actionResult.aloeResult?.token1DebtDelta ?? 0;

    // if any assets or liabilities are < 0, we have an issue!
    if (Object.values(assetsTemp).find((x) => x < 0) || Object.values(liabilitiesTemp).find((x) => x < 0)) {
      problematicActionIdx = i;
      break;
    }
    // if liabilities * 1.08 >= assets, we have an issue! // TODO fetch liquidation factor dynamically
    if (
      sqrtPriceX96 &&
      !isSolvent(assetsTemp, liabilitiesTemp, sqrtPriceX96, marginAccount.token0, marginAccount.token1)
    ) {
      problematicActionIdx = i;
      break;
    }

    // otherwise continue accumulating
    assetsF = assetsTemp;
    liabilitiesF = liabilitiesTemp;
  }

  console.log(assetsF);
  console.log(liabilitiesF);
  console.log(problematicActionIdx);

  const [assetsISum0, assetsISum1] = sumAssetsPerToken(assetsI); // current
  const [assetsFSum0, assetsFSum1] = sumAssetsPerToken(assetsF); // hypothetical
  const hypotheticalChangesToShow = assetsISum0 !== assetsFSum0 || assetsISum1 !== assetsFSum1;

  const [assetsIInTermsOf0, assetsIInTermsOf1] = sqrtPriceX96
    ? inTermsOfEachToken(assetsISum0, assetsISum1, sqrtPriceX96, marginAccount.token0, marginAccount.token1)
    : [0, 0];
  const [assetsFInTermsOf0, assetsFInTermsOf1] = sqrtPriceX96
    ? inTermsOfEachToken(assetsFSum0, assetsFSum1, sqrtPriceX96, marginAccount.token0, marginAccount.token1)
    : [0, 0];
  const [liabilitiesIInTermsOf0, liabilitiesIInTermsOf1] = sqrtPriceX96
    ? inTermsOfEachToken(
        liabilitiesI.amount0,
        liabilitiesI.amount1,
        sqrtPriceX96,
        marginAccount.token0,
        marginAccount.token1
      )
    : [0, 0];
  const [liabilitiesFInTermsOf0, liabilitiesFInTermsOf1] = sqrtPriceX96
    ? inTermsOfEachToken(
        liabilitiesF.amount0,
        liabilitiesF.amount1,
        sqrtPriceX96,
        marginAccount.token0,
        marginAccount.token1
      )
    : [0, 0];

  const [lowerLiquidationThreshold, upperLiquidationThreshold] = [0, 0]; // TODO

  // MARK: Stuff to make display logic easier
  const [selectedToken, unselectedToken] = isToken0Selected
    ? [marginAccount.token0, marginAccount.token1]
    : [marginAccount.token1, marginAccount.token0];
  const shouldDisplayHypotheticals = actionResults.length > 0;

  function updateActionResults(updatedActionResults: ActionCardState[]) {
    setActionResults(updatedActionResults);
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
            id={accountAddressParam || ''}
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
              let activeActionsCopy = [...activeActions];
              setActiveActions(activeActionsCopy.filter((_, i) => i !== index));
            }}
            problematicActionIdx={problematicActionIdx}
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
              <div className='ml-auto'>
                {hypotheticalChangesToShow && (
                  <HypotheticalToggleButton
                    showHypothetical={isShowingHypothetical}
                    setShowHypothetical={setIsShowingHypothetical}
                  />
                )}
              </div>
            </div>
            <AccountStatsGrid>
              <AccountStatsCard
                label='Assets'
                value={`${isToken0Selected ? assetsIInTermsOf0 : assetsIInTermsOf1} ${selectedToken.ticker || ''}`}
                hypothetical={
                  shouldDisplayHypotheticals
                    ? `${isToken0Selected ? assetsFInTermsOf0 : assetsFInTermsOf1} ${selectedToken.ticker || ''}`
                    : undefined
                }
                showHypothetical={isShowingHypothetical}
              />
              <AccountStatsCard
                label='Liabilities'
                value={`${isToken0Selected ? liabilitiesIInTermsOf0 : liabilitiesIInTermsOf1} ${
                  selectedToken.ticker || ''
                }`}
                hypothetical={
                  shouldDisplayHypotheticals
                    ? `${isToken0Selected ? liabilitiesFInTermsOf0 : liabilitiesFInTermsOf1} ${
                        selectedToken.ticker || ''
                      }`
                    : undefined
                }
                showHypothetical={isShowingHypothetical}
              />
              <AccountStatsCard
                label='Lower Liquidation Threshold'
                value={`${lowerLiquidationThreshold} ${selectedToken?.ticker || ''}/${unselectedToken?.ticker || ''}`}
                hypothetical={undefined}
                showHypothetical={isShowingHypothetical}
              />
              <AccountStatsCard
                label='Upper Liquidation Threshold'
                value={`${upperLiquidationThreshold} ${selectedToken?.ticker || ''}/${unselectedToken?.ticker || ''}`}
                hypothetical={undefined}
                showHypothetical={isShowingHypothetical}
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
            <TokenAllocationPieChartWidget
              token0={marginAccount.token0}
              token1={marginAccount.token1}
              assets={marginAccount.assets}
            />
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
