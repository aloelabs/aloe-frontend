import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import tw from 'twin.macro';
import { chain, useContract, useContractRead, useProvider } from 'wagmi';
import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { ReactComponent as PieChartIcon } from '../assets/svg/pie_chart.svg';
import { ReactComponent as TrendingUpIcon } from '../assets/svg/trending_up.svg';
import { AccountStatsCard } from '../components/borrow/AccountStatsCard';
import BorrowSelectActionModal from '../components/borrow/BorrowSelectActionModal';
import { HypotheticalToggleButton } from '../components/borrow/HypotheticalToggleButton';
import ManageAccountWidget from '../components/borrow/ManageAccountWidget';
import MarginAccountHeader from '../components/borrow/MarginAccountHeader';
import TokenAllocationPieChartWidget from '../components/borrow/TokenAllocationPieChartWidget';
import AppPage from 'shared/lib/components/common/AppPage';
import { PreviousPageButton } from '../components/common/Buttons';
import TokenChooser from '../components/common/TokenChooser';
import { Display } from 'shared/lib/components/common/Typography';
import PnLGraph from '../components/graph/PnLGraph';
import { Action, ActionCardState, UniswapPositionPrior } from '../data/Actions';
import { RESPONSIVE_BREAKPOINT_MD, RESPONSIVE_BREAKPOINT_XS } from '../data/constants/Breakpoints';
import { useDebouncedEffect } from '../data/hooks/UseDebouncedEffect';
import {
  computeLiquidationThresholds,
  fetchMarginAccount,
  LiquidationThresholds,
  MarginAccount,
  sumAssetsPerToken,
} from '../data/MarginAccount';
import { formatPriceRatio, formatTokenAmount } from '../util/Numbers';

export const GENERAL_DEBOUNCE_DELAY_MS = 250;
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

const EmptyStateWrapper = styled.div`
  ${tw`w-full`}
  background-color: rgba(13, 24, 33, 1);
  border-radius: 4px;
`;

const EmptyStateContainer = styled.div`
  ${tw`flex flex-col items-center text-center gap-2`}
  width: 300px;
  padding: 24px;
  margin: 0 auto;
`;

const EmptyStateSvgWrapper = styled.div`
  ${tw`flex items-center justify-center`}
  width: 32px;
  height: 32px;

  svg {
    width: 32px;
    height: 32px;
    path {
      /* stroke: rgb(255, 255, 255); */
      stroke: ${SECONDARY_COLOR};
    }
  }
`;

const AccountStatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    grid-template-columns: 1fr;
  }
`;

type AccountParams = {
  account: string;
};

export default function BorrowActionsPage() {
  const navigate = useNavigate();
  const params = useParams<AccountParams>();
  const accountAddressParam = params.account;

  // MARK: component state
  const [isShowingHypothetical, setIsShowingHypothetical] = useState<boolean>(false);
  const [marginAccount, setMarginAccount] = useState<MarginAccount | null>(null);
  const [cumulativeState, setCumulativeState] = useState<MarginAccount | null>(null);
  const [actionResults, setActionResults] = useState<ActionCardState[]>([]);
  const [activeActions, setActiveActions] = useState<Action[]>([]);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [isToken0Selected, setIsToken0Selected] = useState(true);
  // --> state that could be computed in-line, but we use React so that we can debounce liquidation threshold calcs
  // const [hypotheticalStates, setHypotheticalStates] = useState<
  //   {
  //     assets: Assets;
  //     liabilities: Liabilities;
  //     positions: Map<string, UniswapPosition>;
  //   }[]
  // >([]);
  //const [displayedMarginAccount, setDisplayedMarginAccount] = useState<MarginAccount | null>(null);
  //const [displayedUniswapPositions, setDisplayedUniswapPositions] = useState<UniswapPosition[]>([]);
  const [liquidationThresholds, setLiquidationThresholds] = useState<LiquidationThresholds | null>(null);
  const [borrowInterestInputValue, setBorrowInterestInputValue] = useState<string>('');
  const [swapFeesInputValue, setSwapFeesInputValue] = useState<string>('');

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

  useEffect(() => {
    setBorrowInterestInputValue('');
    setSwapFeesInputValue('');
  }, [isToken0Selected]);

  // MARK: fetch margin account
  useEffect(() => {
    let mounted = true;
    async function fetch(marginAccountAddress: string) {
      const fetchedMarginAccount = await fetchMarginAccount(
        marginAccountContract,
        marginAccountLensContract,
        provider,
        marginAccountAddress,
        (uniswapPositionPriors || []) as UniswapPositionPrior[]
      );
      if (mounted) {
        setMarginAccount(fetchedMarginAccount);
        setCumulativeState((prevState: MarginAccount | null) => {
          if (!prevState) {
            return fetchedMarginAccount;
          }
          return prevState;
        });
      }
    }
    if (accountAddressParam) {
      console.log('fetching margin account', accountAddressParam);
      fetch(accountAddressParam);
    }
    return () => {
      mounted = false;
    };
  }, [
    accountAddressParam,
    marginAccountContract,
    marginAccountLensContract,
    provider,
    uniswapPositionPriors,
    uniswapV3PoolContract,
  ]);

  // MARK: fetch uniswap positions
  // useEffect(() => {
  //   let mounted = true;
  //   async function fetch() {
  //     if (!marginAccount || !accountAddressParam || !Array.isArray(uniswapPositionPriors)) return;

  //     const fetchedUniswapPositions = await fetchUniswapPositions(
  //       uniswapPositionPriors as UniswapPositionPrior[],
  //       accountAddressParam,
  //       uniswapV3PoolContract,
  //       marginAccount.sqrtPriceX96,
  //       marginAccount.token0.decimals,
  //       marginAccount.token1.decimals
  //     );

  //     if (mounted) {
  //       setUniswapPositions(fetchedUniswapPositions);
  //       // there may be a slight discrepancy between Sum{uniswapPositions.amountX} and marginAccount.assets.uniX.
  //       // this is because one is computed on-chain and cached, while the other is computed locally.
  //       // if we've fetched both, prefer the uniswapPositions version (local & newer).
  //       const i = { amount0: 0, amount1: 0 };
  //       const { amount0, amount1 } = Array.from(fetchedUniswapPositions.values()).reduce((p, c) => {
  //         return {
  //           amount0: p.amount0 + (c.amount0 || 0),
  //           amount1: p.amount1 + (c.amount1 || 0),
  //         };
  //       }, i);
  //       setMarginAccount({
  //         ...marginAccount,
  //         assets: { ...marginAccount.assets, uni0: amount0, uni1: amount1 },
  //       });
  //     }
  //   }
  //   fetch();

  //   return () => {
  //     mounted = false;
  //   };
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [
  //   accountAddressParam,
  //   marginAccount?.sqrtPriceX96,
  //   marginAccount?.token0,
  //   marginAccount?.token1,
  //   uniswapPositionPriors,
  //   uniswapV3PoolContract,
  // ]);

  // MARK: compute hypothetical states
  useEffect(() => {
    if (!marginAccount) return;

    // assets and liabilities after adding hypothetical actions
    // const _hypotheticalStates = calculateHypotheticalStates(marginAccount, uniswapPositions, actionResults);

    // check whether actions seem valid on the frontend (estimating whether transaction will succeed/fail)
    // const numValidActions = _hypotheticalStates.length - 1;

    // get the latest *valid* hypothetical state. this will be the one we display
    // const {
    //   assets: assetsF,
    //   liabilities: liabilitiesF,
    //   positions: uniswapPositionsF,
    // } = _hypotheticalStates[numValidActions];

    // tell React about our findings
    // const _marginAccount = { ...marginAccount };
    // if (isShowingHypothetical) {
    //   const numericBorrowInterest = parseFloat(borrowInterestInputValue) || 0.0;
    //   const numericSwapFees = parseFloat(swapFeesInputValue) || 0.0;
    //   // Apply the user's inputted swap fees to the displayed margin account's assets
    //   _marginAccount.assets = {
    //     ...assetsF,
    //     token0Raw: assetsF.token0Raw + (isToken0Selected ? numericSwapFees : 0),
    //     token1Raw: assetsF.token1Raw + (isToken0Selected ? 0 : numericSwapFees),
    //   };
    //   // Apply the user's inputted borrow interest to the displayed margin account's liabilities
    //   _marginAccount.liabilities = {
    //     ...liabilitiesF,
    //     amount0: liabilitiesF.amount0 - (isToken0Selected ? numericBorrowInterest : 0),
    //     amount1: liabilitiesF.amount1 - (isToken0Selected ? 0 : numericBorrowInterest),
    //   };
    // }
    // setHypotheticalStates(_hypotheticalStates);
    // setDisplayedMarginAccount(_marginAccount);
    // setDisplayedUniswapPositions(
    //  Array.from((isShowingHypothetical ? uniswapPositionsF : uniswapPositions).values())
    // );
    console.log('Running 1');
  }, [
    marginAccount,
    actionResults,
    isShowingHypothetical,
    isToken0Selected,
    borrowInterestInputValue,
    swapFeesInputValue,
  ]);

  // compute liquidation thresholds for the currently-selected data (current or hypothetical)
  useDebouncedEffect(
    () => {
      if (!cumulativeState) return;
      console.log('Running 2');
      const lt: LiquidationThresholds = computeLiquidationThresholds(cumulativeState, 0.025, 120, 6);
      setLiquidationThresholds(lt);
    },
    GENERAL_DEBOUNCE_DELAY_MS,
    [cumulativeState]
  );

  // if no account data is found, don't render the page
  if (!marginAccount || !cumulativeState) {
    //console.log(marginAccount, displayedMarginAccount);
    return null;
  }

  // flip liquidation thresholds if necessary
  let displayedLiquidationThresholds = liquidationThresholds;
  if (displayedLiquidationThresholds && isToken0Selected) {
    displayedLiquidationThresholds = {
      lower: 1.0 / displayedLiquidationThresholds.upper,
      upper: 1.0 / displayedLiquidationThresholds.lower,
    };
  }

  // check whether actions seem valid on the frontend (estimating whether transaction will succeed/fail)
  // const numValidActions = Math.min(hypotheticalStates.length - 1);
  // const problematicActionIdx = numValidActions < actionResults.length ? numValidActions : -1;
  // check whether we're prepared to send a transaction (independent of whether transaction will succeed/fail)
  const transactionIsReady = actionResults.findIndex((result) => result.actionArgs === undefined) === -1;

  // pre-compute some values to cut down on logic in the HTML
  const token0 = marginAccount.token0;
  const token1 = marginAccount.token1;
  const [selectedToken, unselectedToken] = isToken0Selected ? [token0, token1] : [token1, token0];
  const [assetsSum0, assetsSum1] = sumAssetsPerToken(cumulativeState.assets);
  const isActiveAssetsEmpty = Object.values(cumulativeState.assets).every((a) => a === 0);
  const isActiveLiabilitiesEmpty = Object.values(cumulativeState.liabilities).every((l) => l === 0);

  function updateActionResults(updatedActionResults: ActionCardState[], cumulativeState: MarginAccount | null) {
    setActionResults(updatedActionResults);
    setCumulativeState(cumulativeState);
  }

  function handleAddAction(action: Action) {
    if (actionResults.length === 0) setIsShowingHypothetical(true);
    updateActionResults(
      [
        ...actionResults,
        {
          actionId: action.id,
          aloeResult: null,
          uniswapResult: null,
        },
      ],
      cumulativeState
    );
    setActiveActions([...activeActions, action]);
  }

  function handleAddActions(actions: Action[], defaultActionResults?: ActionCardState[]) {
    if (actionResults.length === 0) setIsShowingHypothetical(true);
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
    updateActionResults([...actionResults, ...newActionResults], cumulativeState);
    setActiveActions([...activeActions, ...actions]);
  }

  function clearActions() {
    updateActionResults([], null);
    setActiveActions([]);
    setIsShowingHypothetical(false);
  }

  return (
    <AppPage>
      <BodyWrapper>
        <div className='flex gap-8 items-center mb-4'>
          <PreviousPageButton onClick={() => navigate('../borrow')} />
          <MarginAccountHeader
            token0={token0}
            token1={token1}
            feeTier={marginAccount.feeTier}
            id={accountAddressParam || ''}
          />
        </div>
        <GridExpandingDiv>
          <ManageAccountWidget
            marginAccount={marginAccount}
            cumulativeState={cumulativeState}
            //uniswapPositions={displayedUniswapPositions}
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
            // problematicActionIdx={problematicActionIdx}
            transactionIsViable={transactionIsReady}
            clearActions={clearActions}
          />
        </GridExpandingDiv>
        <div className='w-full flex flex-col justify-between'>
          <div className='w-full flex flex-col gap-4 mb-8'>
            <div className='flex gap-4 items-center'>
              <Display size='M' weight='medium'>
                Summary
              </Display>
              <TokenChooser
                token0={token0}
                token1={token1}
                isToken0Selected={isToken0Selected}
                setIsToken0Selected={setIsToken0Selected}
              />
              <div className='ml-auto'>
                {actionResults.length > 0 && (
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
                valueLine1={`${formatTokenAmount(assetsSum0, 5)} ${token0.ticker || ''}`}
                valueLine2={`${formatTokenAmount(assetsSum1, 5)} ${token1.ticker || ''}`}
                showAsterisk={isShowingHypothetical}
              />
              <AccountStatsCard
                label='Liabilities'
                valueLine1={`${formatTokenAmount(cumulativeState.liabilities.amount0, 5)} ${token0.ticker || ''}`}
                valueLine2={`${formatTokenAmount(cumulativeState.liabilities.amount1, 5)} ${token1.ticker || ''}`}
                showAsterisk={isShowingHypothetical}
              />
              <AccountStatsCard
                label='Lower Liquidation Threshold'
                valueLine1={
                  displayedLiquidationThresholds
                    ? `${formatPriceRatio(displayedLiquidationThresholds.lower, 5)} ${selectedToken?.ticker || ''}/${
                        unselectedToken?.ticker || ''
                      }`
                    : '-'
                }
                showAsterisk={isShowingHypothetical}
              />
              <AccountStatsCard
                label='Upper Liquidation Threshold'
                valueLine1={
                  displayedLiquidationThresholds
                    ? `${formatPriceRatio(displayedLiquidationThresholds.upper, 5)} ${selectedToken?.ticker || ''}/${
                        unselectedToken?.ticker || ''
                      }`
                    : '-'
                }
                showAsterisk={isShowingHypothetical}
              />
            </AccountStatsGrid>
          </div>
          <div className='w-full flex flex-col gap-4 mb-8'>
            <Display size='M' weight='medium'>
              P&L
            </Display>
            {!isActiveAssetsEmpty || !isActiveLiabilitiesEmpty ? (
              <PnLGraph
                marginAccount={cumulativeState}
                uniswapPositions={cumulativeState.uniswapPositions} // TODO: get this from cumulative state
                inTermsOfToken0={isToken0Selected}
                liquidationThresholds={displayedLiquidationThresholds}
                isShowingHypothetical={isShowingHypothetical}
                borrowInterestInputValue={borrowInterestInputValue}
                swapFeesInputValue={swapFeesInputValue}
                setBorrowInterestInputValue={setBorrowInterestInputValue}
                setSwapFeesInputValue={setSwapFeesInputValue}
              />
            ) : (
              <EmptyStateWrapper>
                <EmptyStateContainer>
                  <EmptyStateSvgWrapper>
                    <TrendingUpIcon />
                  </EmptyStateSvgWrapper>
                  <Display size='XS' color={SECONDARY_COLOR}>
                    A P&L graph of your open positions will appear here.
                  </Display>
                </EmptyStateContainer>
              </EmptyStateWrapper>
            )}
          </div>
          <div className='w-full flex flex-col gap-4'>
            <Display size='M' weight='medium'>
              Token Allocation
            </Display>
            {!isActiveAssetsEmpty ? (
              <TokenAllocationPieChartWidget
                token0={token0}
                token1={token1}
                assets={cumulativeState.assets}
                sqrtPriceX96={marginAccount.sqrtPriceX96}
              />
            ) : (
              <EmptyStateWrapper>
                <EmptyStateContainer>
                  <EmptyStateSvgWrapper>
                    <PieChartIcon />
                  </EmptyStateSvgWrapper>
                  <Display size='XS' color={SECONDARY_COLOR}>
                    A breakdown of your token allocation will appear here.
                  </Display>
                </EmptyStateContainer>
              </EmptyStateWrapper>
            )}
          </div>
        </div>
      </BodyWrapper>
      <BorrowSelectActionModal
        isOpen={actionModalOpen}
        setIsOpen={setActionModalOpen}
        handleAddAction={handleAddAction}
        handleAddActions={handleAddActions}
      />
    </AppPage>
  );
}
