import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import tw from 'twin.macro';
import JSBI from 'jsbi';
import { chain, useContract, useContractRead, useProvider } from 'wagmi';
import { ReactComponent as BackArrowIcon } from '../assets/svg/back_arrow.svg';
import { ReactComponent as LayersIcon } from '../assets/svg/layers.svg';
import { AccountStatsCard } from '../components/borrow/AccountStatsCard';
import { HypotheticalToggleButton } from '../components/borrow/HypotheticalToggleButton';
import ManageAccountWidget from '../components/borrow/ManageAccountWidget';
import MarginAccountHeader from '../components/borrow/MarginAccountHeader';
import TokenAllocationPieChartWidget from '../components/borrow/TokenAllocationPieChartWidget';
import AppPage from '../components/common/AppPage';
import { PreviousPageButton } from '../components/common/Buttons';
import { FullscreenModal } from '../components/common/Modal';
import TokenChooser from '../components/common/TokenChooser';
import { Display, Text } from '../components/common/Typography';
import PnLGraph from '../components/graph/PnLGraph';
import {
  Action,
  ActionCardState,
  ActionProvider,
  ActionProviders,
  ActionTemplates,
  calculateHypotheticalStates,
  calculateUniswapEndState,
  getNameOfAction,
  UniswapPosition,
  UniswapPositionPrior,
} from '../data/Actions';
import { RESPONSIVE_BREAKPOINT_MD } from '../data/constants/Breakpoints';
import { fetchMarginAccount, MarginAccount, sumAssetsPerToken } from '../data/MarginAccount';
import { formatTokenAmount } from '../util/Numbers';
import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { getAmountsFromLiquidity, uniswapPositionKey } from '../util/Uniswap';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

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


type AccountParams = {
  account: string;
};

export default function BorrowActionsPage() {
  const navigate = useNavigate();
  const params = useParams<AccountParams>();
  const accountAddressParam = `0x${params.account}`;

  // MARK: component state
  const [isShowingHypothetical, setIsShowingHypothetical] = useState<boolean>(false);
  const [marginAccount, setMarginAccount] = useState<MarginAccount | null>(null);
  const [uniswapPositions, setUniswapPositions] = useState(new Map<string, UniswapPosition>());
  const [actionResults, setActionResults] = useState<ActionCardState[]>([]);
  const [activeActions, setActiveActions] = useState<Action[]>([]);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [isToken0Selected, setIsToken0Selected] = useState(false);

  // MARK: wagmi hooks
  const provider = useProvider({ chainId: chain.goerli.id });
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
  const { data: uniswapPositionPriors } = useContractRead({
    addressOrName: accountAddressParam ?? '', // TODO better optional resolution
    contractInterface: MarginAccountABI,
    functionName: 'getUniswapPositions',
  });
  const uniswapV3PoolContract = useContract({
    addressOrName: marginAccount?.uniswapPool ?? '', // TODO better option resolution
    contractInterface: UniswapV3PoolABI,
    signerOrProvider: provider,
  });

  // MARK: fetch margin account
  useEffect(() => {
    let mounted = true;
    async function fetch(marginAccountAddress: string) {
      const fetchedMarginAccount = await fetchMarginAccount(
        marginAccountContract,
        marginAccountLensContract,
        provider,
        marginAccountAddress
      );
      if (mounted) {
        setMarginAccount(fetchedMarginAccount);
      }
    }
    if (accountAddressParam) {
      fetch(accountAddressParam);
    }
    return () => {
      mounted = false;
    };
  }, [provider]);

  // MARK: fetch uniswap positions
  useEffect(() => {
    let mounted = true;
    async function fetch(marginAccountAddress: string, priors: UniswapPositionPrior[], marginAccount: MarginAccount) {
      const keys = priors.map(prior => uniswapPositionKey(marginAccountAddress, prior.lower!, prior.upper!));
      const results = await Promise.all(keys.map(key => uniswapV3PoolContract.positions(key)));

      const fetchedUniswapPositions = new Map<string, UniswapPosition>();
      const sqrtPriceX96 = JSBI.BigInt(marginAccount.sqrtPriceX96.toFixed(0));
      priors.forEach((prior, i) => {
        const liquidity = JSBI.BigInt(results[i].liquidity.toString());
        const amounts = getAmountsFromLiquidity(marginAccount.token0, marginAccount.token1, marginAccount.feeTier, sqrtPriceX96, liquidity, prior.lower!, prior.upper!);
        fetchedUniswapPositions.set(keys[i], {
          ...prior,
          liquidity: liquidity,
          amount0: amounts != null ? amounts[0] : 0,
          amount1: amounts != null ? amounts[1] : 0,
        });
      });

      if (mounted) {
        setUniswapPositions(fetchedUniswapPositions);
      }
    }
    if (Array.isArray(uniswapPositionPriors) && marginAccount) {
      fetch(accountAddressParam, uniswapPositionPriors as UniswapPositionPrior[], marginAccount);
    }
    return () => {
      mounted = false;
    }
  }, [uniswapPositionPriors, uniswapV3PoolContract]);

  if (!marginAccount) {
    //If no account data is found, don't render the page
    return null;
  }

  // assets and liabilities before adding any hypothetical actions
  const assetsI = marginAccount.assets;
  const liabilitiesI = marginAccount.liabilities;

  // assets and liabilities after adding hypothetical actions
  const hypotheticalStates = calculateHypotheticalStates(
    marginAccount,
    actionResults
  );

  // uniswap positions after adding hypothetical actions
  const [uniswapPositionsF, numValidActionsUniswap] = calculateUniswapEndState(
    marginAccount,
    actionResults,
    uniswapPositions,
  );

  // check whether actions seem valid on the frontend
  const numValidActions =  Math.min(hypotheticalStates.length - 1, numValidActionsUniswap);
  const problematicActionIdx = numValidActions < actionResults.length ? numValidActions : -1;
  const { assets: assetsF, liabilities: liabilitiesF } = hypotheticalStates[numValidActions];

  // verify that every action has contract params (ready to send on-chain)
  const transactionIsReady = actionResults.findIndex((result) => result.actionArgs === undefined) === -1;

  const [assetsISum0, assetsISum1] = sumAssetsPerToken(assetsI); // current
  const [assetsFSum0, assetsFSum1] = sumAssetsPerToken(assetsF); // hypothetical

  const [lowerLiquidationThreshold, upperLiquidationThreshold] = [0, 0]; // TODO

  // MARK: Stuff to make display logic easier
  const [selectedToken, unselectedToken] = isToken0Selected
    ? [marginAccount.token0, marginAccount.token1]
    : [marginAccount.token1, marginAccount.token0];

  function updateActionResults(updatedActionResults: ActionCardState[]) {
    setActionResults(updatedActionResults);
  }

  function handleAddAction(action: Action) {
    if (actionResults.length === 0) setIsShowingHypothetical(true);
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
            marginAccount={marginAccount}
            hypotheticalStates={hypotheticalStates}
            uniswapPositions={Array.from(uniswapPositions.values())}
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
            transactionIsViable={transactionIsReady}
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
                {(actionResults.length > 0) && (
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
                valueLine1={
                  `${formatTokenAmount(isShowingHypothetical ? assetsFSum0 : assetsISum0, 5)} ${marginAccount.token0.ticker || ''}`
                }
                valueLine2={
                  `${formatTokenAmount(isShowingHypothetical ? assetsFSum1 : assetsISum1, 5)} ${marginAccount.token1.ticker || ''}`
                }
                showAsterisk={isShowingHypothetical}
              />
              <AccountStatsCard
                label='Liabilities'
                valueLine1={
                  `${
                    formatTokenAmount(isShowingHypothetical ? liabilitiesF.amount0 : liabilitiesI.amount0, 5)
                  } ${marginAccount.token0.ticker || ''}`
                }
                valueLine2={
                  `${
                    formatTokenAmount(isShowingHypothetical ? liabilitiesF.amount1 : liabilitiesI.amount1, 5)
                  } ${marginAccount.token1.ticker || ''}`
                }
                showAsterisk={isShowingHypothetical}
              />
              <AccountStatsCard
                label='Lower Liquidation Threshold'
                valueLine1={`${lowerLiquidationThreshold} ${selectedToken?.ticker || ''}/${unselectedToken?.ticker || ''}`}
                showAsterisk={isShowingHypothetical}
              />
              <AccountStatsCard
                label='Upper Liquidation Threshold'
                valueLine1={`${upperLiquidationThreshold} ${selectedToken?.ticker || ''}/${unselectedToken?.ticker || ''}`}
                showAsterisk={isShowingHypothetical}
              />
            </AccountStatsGrid>
          </div>
          <div className='w-full flex flex-col gap-4 mb-8'>
            <Display size='M' weight='medium'>
              PnL
            </Display>
            <PnLGraph
              marginAccount={{
                ...marginAccount,
                assets: isShowingHypothetical ? assetsF : marginAccount.assets,
                liabilities: isShowingHypothetical ? liabilitiesF : marginAccount.liabilities,
              }}
              inTermsOfToken0={isToken0Selected}
            />
          </div>
          <div className='w-full flex flex-col gap-4'>
            <Display size='M' weight='medium'>
              Token Allocation
            </Display>
            <TokenAllocationPieChartWidget
              token0={marginAccount.token0}
              token1={marginAccount.token1}
              assets={isShowingHypothetical ? assetsF : marginAccount.assets}
              sqrtPriceX96={marginAccount.sqrtPriceX96}
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
