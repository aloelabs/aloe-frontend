import Big from 'big.js';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import tw from 'twin.macro';
import { useContract, useProvider } from 'wagmi';
import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
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
  calculateHypotheticalState,
  getNameOfAction,
} from '../data/Actions';
import { RESPONSIVE_BREAKPOINT_MD } from '../data/constants/Breakpoints';
import { BIGQ96 } from '../data/constants/Values';
import { fetchMarginAccount, isSolvent, MarginAccount, sumAssetsPerToken } from '../data/MarginAccount';
import { TokenData } from '../data/TokenData';

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

function inTermsOfEachToken(
  amount0: number,
  amount1: number,
  sqrtPriceX96: Big,
  token0: TokenData,
  token1: TokenData
): [number, number] {
  const priceX96 = sqrtPriceX96.mul(sqrtPriceX96).div(BIGQ96);

  const inTermsOfToken1 =
    amount1 +
    priceX96
      .mul(amount0)
      .mul(10 ** token0.decimals)
      .div(BIGQ96)
      .div(10 ** token1.decimals)
      .toNumber();
  const inTermsOfToken0 =
    amount0 +
    BIGQ96.mul(amount1)
      .mul(10 ** token1.decimals)
      .div(priceX96)
      .div(10 ** token0.decimals)
      .toNumber();

  return [inTermsOfToken0, inTermsOfToken1];
}

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
  const [actionResults, setActionResults] = useState<ActionCardState[]>([]);
  const [activeActions, setActiveActions] = useState<Action[]>([]);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [isToken0Selected, setIsToken0Selected] = useState(false);

  // MARK: wagmi hooks
  const provider = useProvider();
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

  if (!marginAccount) {
    //If no account data is found, don't render the page
    return null;
  }

  const sqrtPriceX96 = marginAccount.sqrtPriceX96;
  // assets and liabilities before adding any hypothetical actions
  const assetsI = marginAccount.assets;
  const liabilitiesI = marginAccount.liabilities;

  // assets and liabilities after adding hypothetical actions

  // let assetsF = { ...assetsI };
  // let liabilitiesF = { ...liabilitiesI };
  // let problematicActionIdx: number | null = null;

  const { assetsF, liabilitiesF, problematicActionIdx } = calculateHypotheticalState(
    assetsI,
    liabilitiesI,
    actionResults
  );

  const setOfActionsIsProblematic = (problematicActionIdx === -1) && !isSolvent(assetsF, liabilitiesF, sqrtPriceX96, marginAccount.token0, marginAccount.token1);

  console.log(assetsF);
  console.log(liabilitiesF);
  console.log(problematicActionIdx);

  const [assetsISum0, assetsISum1] = sumAssetsPerToken(assetsI); // current
  const [assetsFSum0, assetsFSum1] = sumAssetsPerToken(assetsF); // hypothetical
  const hypotheticalChangesToShow = actionResults.length > 0;

  const [assetsIInTermsOf0, assetsIInTermsOf1] = inTermsOfEachToken(
    assetsISum0,
    assetsISum1,
    sqrtPriceX96,
    marginAccount.token0,
    marginAccount.token1
  );
  const [assetsFInTermsOf0, assetsFInTermsOf1] = inTermsOfEachToken(
    assetsFSum0,
    assetsFSum1,
    sqrtPriceX96,
    marginAccount.token0,
    marginAccount.token1
  );
  const [liabilitiesIInTermsOf0, liabilitiesIInTermsOf1] = inTermsOfEachToken(
    liabilitiesI.amount0,
    liabilitiesI.amount1,
    sqrtPriceX96,
    marginAccount.token0,
    marginAccount.token1
  );
  const [liabilitiesFInTermsOf0, liabilitiesFInTermsOf1] = inTermsOfEachToken(
    liabilitiesF.amount0,
    liabilitiesF.amount1,
    sqrtPriceX96,
    marginAccount.token0,
    marginAccount.token1
  );

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
            token0={marginAccount.token0}
            token1={marginAccount.token1}
            kitty0={marginAccount.kitty0}
            kitty1={marginAccount.kitty1}
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
            setOfActionsIsProblematic={setOfActionsIsProblematic}
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
          <div className='w-full flex flex-col gap-4 mb-8'>
            <Display size='M' weight='medium'>
              PnL
            </Display>
            <PnLGraph marginAccount={marginAccount} />
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
