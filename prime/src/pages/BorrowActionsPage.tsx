import { useCallback, useContext, useEffect, useState, useMemo } from 'react';

import { TickMath } from '@uniswap/v3-sdk';
import { BigNumber, Contract } from 'ethers';
import JSBI from 'jsbi';
import { useNavigate, useParams } from 'react-router-dom';
import { PreviousPageButton } from 'shared/lib/components/common/Buttons';
import { Text, Display } from 'shared/lib/components/common/Typography';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { formatPriceRatio } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import tw from 'twin.macro';
import { useContract, useContractRead, useProvider } from 'wagmi';

import { ChainContext, useGeoFencing } from '../App';
import KittyLensAbi from '../assets/abis/KittyLens.json';
import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { ReactComponent as InboxIcon } from '../assets/svg/inbox.svg';
import { ReactComponent as PieChartIcon } from '../assets/svg/pie_chart.svg';
import { ReactComponent as TrendingUpIcon } from '../assets/svg/trending_up.svg';
import { AccountStatsCard } from '../components/borrow/AccountStatsCard';
import { HypotheticalToggleButton } from '../components/borrow/HypotheticalToggleButton';
import ManageAccountWidget from '../components/borrow/ManageAccountWidget';
import MarginAccountHeader from '../components/borrow/MarginAccountHeader';
import TokenAllocationPieChartWidget from '../components/borrow/TokenAllocationPieChartWidget';
import UniswapPositionTable from '../components/borrow/uniswap/UniswapPositionsTable';
import TokenChooser from '../components/common/TokenChooser';
import PnLGraph from '../components/graph/PnLGraph';
import { AccountState, UniswapPosition, UniswapPositionPrior } from '../data/actions/Actions';
import { isSolvent, sumAssetsPerToken } from '../data/BalanceSheet';
import { ALOE_II_BORROWER_LENS_ADDRESS, ALOE_II_LENDER_LENS_ADDRESS } from '../data/constants/Addresses';
import {
  RESPONSIVE_BREAKPOINT_MD,
  RESPONSIVE_BREAKPOINT_SM,
  RESPONSIVE_BREAKPOINT_XS,
} from '../data/constants/Breakpoints';
import { useDebouncedEffect } from '../data/hooks/UseDebouncedEffect';
import { fetchMarginAccount, LiquidationThresholds, MarginAccount } from '../data/MarginAccount';
import { fetchMarketInfoFor, MarketInfo } from '../data/MarketInfo';
import { RateModel, yieldPerSecondToAPR } from '../data/RateModel';
import {
  ComputeLiquidationThresholdsRequest,
  stringifyMarginAccount,
  stringifyUniswapPositions,
} from '../util/ComputeLiquidationThresholdUtils';
import { getAmountsForLiquidity, uniswapPositionKey } from '../util/Uniswap';

export const GENERAL_DEBOUNCE_DELAY_MS = 250;
const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const GREEN_COLOR = 'rgba(0, 189, 63, 1)';
const RED_COLOR = 'rgba(234, 87, 87, 0.75)';

const BodyWrapper = styled.div`
  display: grid;
  width: 100%;
  grid-template-columns: calc(100% - 582px) 550px;
  gap: 32px;
  padding-left: 64px;
  padding-right: 64px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    grid-template-columns: 100%;
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    padding-left: 32px;
    padding-right: 32px;
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    // TODO: standardize this across all pages that use this padding
    padding-left: 16px;
    padding-right: 16px;
  }
`;

const HeaderBarContainer = styled.div`
  ${tw`flex items-center mb-10`}
  padding-top: 64px;
  gap: 32px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    display: grid;
    grid-template-columns: fit-content(35px) fit-content(400px) fit-content(24px);
    align-items: flex-start;
    justify-content: flex-start;
    gap: 16px;
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    padding-top: 48px;
  }
`;

const GridExpandingDiv = styled.div`
  grid-row: 1 / 4;
  grid-column: 2 / span 1;
  justify-self: center;
  margin-top: 96px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    justify-self: start;
    grid-row: 2 / span 1;
    grid-column: 1 / span 1;
    margin-top: 0px;
    margin-bottom: 0px;
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
  grid-template-columns: repeat(2, calc(50% - 8px));
  gap: 16px;
  max-width: 100%;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    grid-template-columns: 1fr;
  }
`;

const MarketStatsGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 100%;
`;

export type UniswapPositionEarnedFees = {
  [key: string]: {
    token0FeesEarned: GN;
    token1FeesEarned: GN;
  };
};

type AccountParams = {
  account: string;
};

async function fetchUniswapPositions(
  priors: UniswapPositionPrior[],
  marginAccountAddress: string,
  uniswapV3PoolContract: any
) {
  const keys = priors.map((prior) => uniswapPositionKey(marginAccountAddress, prior.lower!, prior.upper!));
  const results = await Promise.all(keys.map((key) => uniswapV3PoolContract.positions(key)));

  const fetchedUniswapPositions = new Map<string, UniswapPosition>();
  priors.forEach((prior, i) => {
    const liquidity = JSBI.BigInt(results[i].liquidity.toString());
    fetchedUniswapPositions.set(keys[i], { ...prior, liquidity: liquidity });
  });

  return fetchedUniswapPositions;
}

export default function BorrowActionsPage() {
  const { activeChain } = useContext(ChainContext);
  const isAllowedToInteract = useGeoFencing(activeChain);

  const navigate = useNavigate();
  const params = useParams<AccountParams>();
  const accountAddressParam = params.account;

  const worker: Worker = useMemo(() => {
    return new Worker(new URL('../computeLiquidationThresholdsWorker.ts', import.meta.url));
  }, []);

  // MARK: component state
  const [userWantsHypothetical, setUserWantsHypothetical] = useState<boolean>(false);
  const [marginAccount, setMarginAccount] = useState<MarginAccount | null>(null);
  const [uniswapPositions, setUniswapPositions] = useState<readonly UniswapPosition[]>([]);
  const [isToken0Selected, setIsToken0Selected] = useState(true);
  const [marketInfo, setMarketInfo] = useState<MarketInfo | null>(null);
  // --> state that could be computed in-line, but we use React so that we can debounce liquidation threshold calcs
  const [hypotheticalState, setHypotheticalState] = useState<AccountState | null>(null);
  const [displayedMarginAccount, setDisplayedMarginAccount] = useState<MarginAccount | null>(null);
  const [displayedUniswapPositions, setDisplayedUniswapPositions] = useState<readonly UniswapPosition[]>([]);
  const [liquidationThresholds, setLiquidationThresholds] = useState<LiquidationThresholds | null>(null);
  const [borrowInterestInputValue, setBorrowInterestInputValue] = useState<string>('');
  const [swapFeesInputValue, setSwapFeesInputValue] = useState<string>('');
  const [uniswapPositionEarnedFees, setUniswapPositionEarnedFees] = useState<UniswapPositionEarnedFees>({});

  // MARK: worker message handling (for liquidation threshold calcs)
  useEffect(() => {
    let mounted = true;
    const handleWorkerMessage = (e: MessageEvent<string>) => {
      try {
        const response = JSON.parse(e.data) as LiquidationThresholds;
        // Only set state if the component is still mounted
        if (mounted) setLiquidationThresholds(response);
      } catch (error) {
        console.error(error);
      }
    };
    // Add event listener for worker messages
    if (window.Worker) worker.addEventListener('message', handleWorkerMessage);
    return () => {
      if (window.Worker) {
        worker.removeEventListener('message', handleWorkerMessage);
        worker.terminate();
      }
      mounted = false;
    };
  }, [worker]);

  // MARK: wagmi hooks
  const provider = useProvider({ chainId: activeChain.id });
  const marginAccountLensContract = useContract({
    address: ALOE_II_BORROWER_LENS_ADDRESS,
    abi: MarginAccountLensABI,
    signerOrProvider: provider,
  });
  const lenderLensContract = useContract({
    address: ALOE_II_LENDER_LENS_ADDRESS,
    abi: KittyLensAbi,
    signerOrProvider: provider,
  });
  const { data: uniswapPositionTicks } = useContractRead({
    address: accountAddressParam ?? '0x', // TODO better optional resolution
    abi: MarginAccountABI,
    functionName: 'getUniswapPositions',
    chainId: activeChain.id,
  });
  const uniswapV3PoolContract = useContract({
    address: marginAccount?.uniswapPool ?? '0x', // TODO better option resolution
    abi: UniswapV3PoolABI,
    signerOrProvider: provider,
  });

  useEffect(() => {
    setBorrowInterestInputValue('');
    setSwapFeesInputValue('');
  }, [isToken0Selected]);

  // MARK: fetch margin account
  useEffect(() => {
    let mounted = true;
    // Ensure we have non-null values
    async function fetch(marginAccountAddress: string) {
      const result = await fetchMarginAccount(
        accountAddressParam ?? '0x', // TODO better optional resolution
        activeChain,
        provider,
        marginAccountAddress
      );
      if (mounted) {
        setMarginAccount(result.marginAccount);
      }
    }
    if (accountAddressParam) {
      fetch(accountAddressParam);
    }
    return () => {
      mounted = false;
    };
  }, [accountAddressParam, provider, activeChain]);

  // MARK: fetch MarketInfo
  useEffect(() => {
    let mounted = true;
    async function fetchMarketInfo() {
      if (!lenderLensContract || !marginAccount) return;
      const fetchedMarketInfo = await fetchMarketInfoFor(
        lenderLensContract,
        marginAccount.lender0,
        marginAccount.lender1,
        marginAccount.token0.decimals,
        marginAccount.token1.decimals
      );
      if (mounted) setMarketInfo(fetchedMarketInfo);
    }
    fetchMarketInfo();
    return () => {
      mounted = false;
    };
  }, [lenderLensContract, marginAccount]);

  // MARK: fetch uniswap positions
  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (!marginAccount || !accountAddressParam || !Array.isArray(uniswapPositionTicks)) return;

      const uniswapPositionPriors: UniswapPositionPrior[] = [];
      for (let i = 0; i < uniswapPositionTicks.length; i += 2) {
        uniswapPositionPriors.push({
          lower: uniswapPositionTicks[i] as number,
          upper: uniswapPositionTicks[i + 1] as number,
        });
      }

      const fetchedUniswapPositions = await fetchUniswapPositions(
        uniswapPositionPriors,
        accountAddressParam,
        uniswapV3PoolContract
      );
      const _uniswapPositions = Array.from(fetchedUniswapPositions.values());

      if (mounted) {
        setUniswapPositions(_uniswapPositions);
        const token0 = marginAccount.token0;
        const token1 = marginAccount.token1;
        // there may be a slight discrepancy between Sum{uniswapPositions.amountX} and marginAccount.assets.uniX.
        // this is because one is computed on-chain and cached, while the other is computed locally.
        // if we've fetched both, prefer the uniswapPositions version (local & newer).
        const i = { amount0: GN.zero(token0.decimals), amount1: GN.zero(token1.decimals) };
        const { amount0, amount1 } = _uniswapPositions.reduce((p, c) => {
          const [amount0, amount1] = getAmountsForLiquidity(
            c.liquidity,
            c.lower,
            c.upper,
            TickMath.getTickAtSqrtRatio(marginAccount.sqrtPriceX96.toJSBI()),
            marginAccount.token0.decimals,
            marginAccount.token1.decimals
          );
          return {
            amount0: p.amount0.add(amount0),
            amount1: p.amount1.add(amount1),
          };
        }, i);
        setMarginAccount({
          ...marginAccount,
          assets: { ...marginAccount.assets, uni0: amount0, uni1: amount1 },
        });
      }
    }
    fetch();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accountAddressParam,
    marginAccount?.sqrtPriceX96,
    marginAccount?.token0,
    marginAccount?.token1,
    uniswapPositionTicks,
    uniswapV3PoolContract,
  ]);

  // MARK: compute hypothetical states
  useEffect(() => {
    if (!marginAccount) return;

    if (!hypotheticalState) {
      setDisplayedMarginAccount(marginAccount);
      setDisplayedUniswapPositions(uniswapPositions);
      return;
    }

    // get the latest *valid* hypothetical state. this will be the one we display
    const { assets: assetsF, liabilities: liabilitiesF, uniswapPositions: uniswapPositionsF } = hypotheticalState;

    // tell React about our findings
    const _marginAccount = { ...marginAccount };
    if (userWantsHypothetical) {
      const token0Decimals = marginAccount.token0.decimals;
      const token1Decimals = marginAccount.token1.decimals;
      const selectedToken = isToken0Selected ? marginAccount.token0 : marginAccount.token1;
      const numericBorrowInterest = GN.fromDecimalString(borrowInterestInputValue || '0', selectedToken.decimals);
      const numericSwapFees = GN.fromDecimalString(swapFeesInputValue || '0', selectedToken.decimals);
      // Apply the user's inputted swap fees to the displayed margin account's assets
      _marginAccount.assets = {
        ...assetsF,
        token0Raw: assetsF.token0Raw.add(isToken0Selected ? numericSwapFees : GN.zero(token0Decimals)),
        token1Raw: assetsF.token1Raw.add(isToken0Selected ? GN.zero(token1Decimals) : numericSwapFees),
      };
      // Apply the user's inputted borrow interest to the displayed margin account's liabilities
      _marginAccount.liabilities = {
        ...liabilitiesF,
        amount0: liabilitiesF.amount0.sub(isToken0Selected ? numericBorrowInterest : GN.zero(token0Decimals)),
        amount1: liabilitiesF.amount1.sub(isToken0Selected ? GN.zero(token1Decimals) : numericBorrowInterest),
      };
    }
    setDisplayedMarginAccount(_marginAccount);
    setDisplayedUniswapPositions(userWantsHypothetical ? uniswapPositionsF : uniswapPositions);
  }, [
    marginAccount,
    uniswapPositions,
    hypotheticalState,
    userWantsHypothetical,
    isToken0Selected,
    borrowInterestInputValue,
    swapFeesInputValue,
  ]);

  // compute liquidation thresholds for the currently-selected data (current or hypothetical)
  useDebouncedEffect(
    () => {
      if (!window.Worker || !displayedMarginAccount) return;
      worker.postMessage({
        marginAccountParams: stringifyMarginAccount(displayedMarginAccount),
        uniswapPositionParams: stringifyUniswapPositions(displayedUniswapPositions.concat()),
        sigma: 0.025,
        iterations: 120,
        precision: 6,
      } as ComputeLiquidationThresholdsRequest);
    },
    GENERAL_DEBOUNCE_DELAY_MS,
    [displayedMarginAccount, displayedUniswapPositions]
  );

  // MARK: fetch uniswap fees earned
  useEffect(() => {
    let mounted = true;
    if (marginAccount == null) {
      return;
    }
    async function fetch(marginAccountLensContract: Contract, marginAccount: MarginAccount) {
      const earnedFees: [string[], BigNumber[]] = await marginAccountLensContract.getUniswapFees(marginAccount.address);
      const earnedFeesMap: UniswapPositionEarnedFees = {};
      earnedFees[0].forEach((positionId, index) => {
        earnedFeesMap[positionId] = {
          token0FeesEarned: GN.fromBigNumber(earnedFees[1][index * 2], marginAccount.token0.decimals),
          token1FeesEarned: GN.fromBigNumber(earnedFees[1][index * 2 + 1], marginAccount.token1.decimals),
        };
      });
      if (mounted) {
        setUniswapPositionEarnedFees(earnedFeesMap);
      }
    }
    if (marginAccountLensContract && marginAccount) {
      fetch(marginAccountLensContract, marginAccount);
    }

    return () => {
      mounted = false;
    };
  }, [marginAccount, marginAccountLensContract]);

  // MARK: compute uniswap fees earned
  useEffect(() => {
    if (!uniswapPositionEarnedFees || !displayedUniswapPositions || !marginAccount || !displayedMarginAccount) {
      return;
    }
    const { token0, token1 } = marginAccount;
    const earnedFeesValues = Object.values(uniswapPositionEarnedFees);
    const priceX96 = marginAccount.sqrtPriceX96.square();
    const token0FeesEarned = earnedFeesValues.reduce((p, c) => p.add(c.token0FeesEarned), GN.zero(token0.decimals));
    const token1FeesEarned = earnedFeesValues.reduce((p, c) => p.add(c.token1FeesEarned), GN.zero(token1.decimals));
    const token0FeesEarnedInTermsOfToken1 = token0FeesEarned.mul(priceX96).setResolution(token1.decimals);
    const totalFeesEarnedInTermsOfToken1 = token1FeesEarned.add(token0FeesEarnedInTermsOfToken1);
    if (totalFeesEarnedInTermsOfToken1.isGtZero()) {
      if (isToken0Selected) {
        const totalFeesEarnedInTermsOfToken0 = totalFeesEarnedInTermsOfToken1
          .div(priceX96)
          .setResolution(token0.decimals);
        setSwapFeesInputValue(totalFeesEarnedInTermsOfToken0.toString(GNFormat.DECIMAL));
      } else {
        setSwapFeesInputValue(totalFeesEarnedInTermsOfToken1.toString(GNFormat.DECIMAL));
      }
    }
  }, [marginAccount, displayedMarginAccount, uniswapPositionEarnedFees, displayedUniswapPositions, isToken0Selected]);

  const updateHypotheticalState = useCallback((state: AccountState | null) => {
    setHypotheticalState(state);
  }, []);

  // if no account data is found, don't render the page
  if (!marginAccount || !displayedMarginAccount) {
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

  // pre-compute some values to cut down on logic in the HTML
  const token0 = marginAccount.token0;
  const token1 = marginAccount.token1;
  const [selectedToken, unselectedToken] = isToken0Selected ? [token0, token1] : [token1, token0];
  const [assetsSum0, assetsSum1] = sumAssetsPerToken(displayedMarginAccount.assets);
  const isActiveAssetsEmpty = Object.values(displayedMarginAccount.assets).every((a) => a.isZero());
  const isActiveLiabilitiesEmpty = Object.values(displayedMarginAccount.liabilities).every((l) => l.isZero());
  const selectedTokenTicker = selectedToken?.ticker || '';
  const unselectedTokenTicker = unselectedToken?.ticker || '';

  const { health } = isSolvent(
    displayedMarginAccount.assets,
    displayedMarginAccount.liabilities,
    displayedUniswapPositions,
    displayedMarginAccount.sqrtPriceX96,
    displayedMarginAccount.iv,
    token0.decimals,
    token1.decimals
  );
  displayedMarginAccount.health = health;

  const isShowingHypothetical = userWantsHypothetical && hypotheticalState !== null;

  // hypothetical interest rates
  let utilization0 = marketInfo?.lender0Utilization;
  let utilization1 = marketInfo?.lender1Utilization;
  if (marketInfo && isShowingHypothetical) {
    utilization0 =
      GN.one(token0.decimals)
        .sub(hypotheticalState.availableForBorrow.amount0.div(marketInfo.lender0TotalAssets))
        .toNumber() || 0;
    utilization1 =
      GN.one(token1.decimals)
        .sub(hypotheticalState.availableForBorrow.amount1.div(marketInfo.lender1TotalAssets))
        .toNumber() || 0;
  }
  const apr0 = yieldPerSecondToAPR(RateModel.computeYieldPerSecond(utilization0 || 0));
  const apr1 = yieldPerSecondToAPR(RateModel.computeYieldPerSecond(utilization1 || 0));

  return (
    <BodyWrapper>
      <HeaderBarContainer>
        <PreviousPageButton onClick={() => navigate('../borrow')} />
        <MarginAccountHeader
          token0={token0}
          token1={token1}
          feeTier={marginAccount.feeTier}
          id={accountAddressParam || ''}
        />
      </HeaderBarContainer>
      <GridExpandingDiv>
        <ManageAccountWidget
          marketInfo={marketInfo}
          marginAccount={marginAccount}
          uniswapPositions={uniswapPositions}
          enabled={isAllowedToInteract}
          updateHypotheticalState={updateHypotheticalState}
          onAddFirstAction={() => setUserWantsHypothetical(true)}
        />
      </GridExpandingDiv>
      <div className='w-full flex flex-col justify-between'>
        <div className='w-full flex flex-col gap-4 mb-8'>
          <div className='flex gap-4 items-center'>
            <Text size='L' weight='medium'>
              Account Summary
            </Text>
            <TokenChooser
              token0={token0}
              token1={token1}
              isToken0Selected={isToken0Selected}
              setIsToken0Selected={setIsToken0Selected}
            />
            <div className='ml-auto'>
              {hypotheticalState && (
                <HypotheticalToggleButton
                  showHypothetical={userWantsHypothetical}
                  setShowHypothetical={setUserWantsHypothetical}
                />
              )}
            </div>
          </div>
          <AccountStatsGrid>
            <AccountStatsCard
              label='Assets'
              value={assetsSum0.toString(GNFormat.LOSSY_HUMAN)}
              denomination={token0.ticker ?? ''}
              boxColor={GREEN_COLOR}
              showAsterisk={isShowingHypothetical}
            />
            <AccountStatsCard
              label='Assets'
              value={assetsSum1.toString(GNFormat.LOSSY_HUMAN)}
              denomination={token1.ticker ?? ''}
              boxColor={GREEN_COLOR}
              showAsterisk={isShowingHypothetical}
            />
            <AccountStatsCard
              label='Liabilities'
              value={`-${displayedMarginAccount.liabilities.amount0.toString(GNFormat.LOSSY_HUMAN)}`}
              denomination={token0.ticker ?? ''}
              boxColor={RED_COLOR}
              showAsterisk={isShowingHypothetical}
            />
            <AccountStatsCard
              label='Liabilities'
              value={`-${displayedMarginAccount.liabilities.amount1.toString(GNFormat.LOSSY_HUMAN)}`}
              denomination={token1.ticker ?? ''}
              boxColor={RED_COLOR}
              showAsterisk={isShowingHypothetical}
            />
            <AccountStatsCard
              label='Lower Liquidation Threshold'
              value={
                displayedLiquidationThresholds ? `${formatPriceRatio(displayedLiquidationThresholds.lower, 4)}` : '-'
              }
              denomination={
                displayedLiquidationThresholds ? `${selectedTokenTicker}/${unselectedTokenTicker}` : undefined
              }
              showAsterisk={isShowingHypothetical}
            />
            <AccountStatsCard
              label='Upper Liquidation Threshold'
              value={
                displayedLiquidationThresholds ? `${formatPriceRatio(displayedLiquidationThresholds.upper, 4)}` : '-'
              }
              denomination={
                displayedLiquidationThresholds ? `${selectedTokenTicker}/${unselectedTokenTicker}` : undefined
              }
              showAsterisk={isShowingHypothetical}
            />
          </AccountStatsGrid>
        </div>
        {marketInfo !== null && (
          <div className='w-full flex flex-col gap-4 mb-8'>
            <Text size='L' weight='medium'>
              Market Stats
            </Text>
            <MarketStatsGrid>
              <AccountStatsCard
                label={`${token0.ticker} Supply`}
                value={marketInfo.lender0TotalAssets.toString(GNFormat.LOSSY_HUMAN)}
                denomination={token0.ticker}
                showAsterisk={false}
              />
              <div className='grid grid-cols-2 gap-4'>
                <AccountStatsCard
                  label={`${token0.ticker} Utilization`}
                  value={`${(utilization0! * 100).toFixed(2)}%`}
                  showAsterisk={isShowingHypothetical}
                />
                <AccountStatsCard
                  label={`${token0.ticker} APR`}
                  value={`${(apr0 * 100).toFixed(2)}%`}
                  showAsterisk={isShowingHypothetical}
                />
              </div>
              <AccountStatsCard
                label={`${token1.ticker} Supply`}
                value={marketInfo.lender1TotalAssets.toString(GNFormat.LOSSY_HUMAN)}
                denomination={token1.ticker}
                showAsterisk={false}
              />
              <div className='grid grid-cols-2 gap-4'>
                <AccountStatsCard
                  label={`${token1.ticker} Utilization`}
                  value={`${(utilization1! * 100).toFixed(2)}%`}
                  showAsterisk={isShowingHypothetical}
                />
                <AccountStatsCard
                  label={`${token1.ticker} APR`}
                  value={`${(apr1 * 100).toFixed(2)}%`}
                  showAsterisk={isShowingHypothetical}
                />
              </div>
            </MarketStatsGrid>
          </div>
        )}
        <div className='w-full mb-8'>
          {!isActiveAssetsEmpty || !isActiveLiabilitiesEmpty ? (
            <PnLGraph
              marginAccount={displayedMarginAccount}
              uniswapPositions={displayedUniswapPositions.concat()}
              inTermsOfToken0={isToken0Selected}
              liquidationThresholds={displayedLiquidationThresholds}
              isShowingHypothetical={isShowingHypothetical}
              borrowInterestInputValue={borrowInterestInputValue}
              swapFeesInputValue={swapFeesInputValue}
              setBorrowInterestInputValue={setBorrowInterestInputValue}
              setSwapFeesInputValue={setSwapFeesInputValue}
            />
          ) : (
            <div className='w-full flex flex-col gap-4'>
              <Text size='L' weight='medium'>
                P&L
              </Text>
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
            </div>
          )}
        </div>
        <div className='w-full flex flex-col gap-4 mb-8'>
          <Text size='L' weight='medium'>
            Uniswap Positions
          </Text>
          {displayedUniswapPositions.length === 0 ? (
            <EmptyStateWrapper>
              <EmptyStateContainer>
                <EmptyStateSvgWrapper>
                  <InboxIcon />
                </EmptyStateSvgWrapper>
                <Display size='XS' color={SECONDARY_COLOR}>
                  A list of your open Uniswap positions will appear here.
                </Display>
              </EmptyStateContainer>
            </EmptyStateWrapper>
          ) : (
            <UniswapPositionTable
              accountAddress={accountAddressParam || ''}
              marginAccount={marginAccount}
              provider={provider}
              uniswapPositions={displayedUniswapPositions}
              uniswapPositionEarnedFees={uniswapPositionEarnedFees}
              isInTermsOfToken0={isToken0Selected}
              showAsterisk={isShowingHypothetical}
            />
          )}
        </div>
        <div className='w-full flex flex-col gap-4'>
          <Text size='L' weight='medium'>
            Token Allocation
          </Text>
          {!isActiveAssetsEmpty ? (
            <TokenAllocationPieChartWidget
              token0={token0}
              token1={token1}
              assets={displayedMarginAccount.assets}
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
  );
}
