import { useContext, useEffect, useMemo } from 'react';

import { ApolloQueryResult } from '@apollo/react-hooks';
import { TickMath } from '@uniswap/v3-sdk';
import { SendTransactionResult } from '@wagmi/core';
import axios, { AxiosResponse } from 'axios';
import Big from 'big.js';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { lenderLensAbi } from 'shared/lib/abis/LenderLens';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import { Text, Display } from 'shared/lib/components/common/Typography';
import {
  ALOE_II_BOOST_MANAGER_ADDRESS,
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_LENDER_LENS_ADDRESS,
  UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import useSafeState from 'shared/lib/data/hooks/UseSafeState';
import { Token } from 'shared/lib/data/Token';
import { getTokenBySymbol } from 'shared/lib/data/TokenData';
import { formatUSD } from 'shared/lib/util/Numbers';
import { generateBytes12Salt } from 'shared/lib/util/Salt';
import styled from 'styled-components';
import {
  Address,
  erc721ABI,
  useAccount,
  useBalance,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useProvider,
  useWaitForTransaction,
} from 'wagmi';

import { ChainContext } from '../../App';
import { fetchListOfBorrowerNfts } from '../../data/BorrowerNft';
import { API_PRICE_RELAY_LATEST_URL } from '../../data/constants/Values';
import { fetchMarketInfoFor, MarketInfo } from '../../data/MarketInfo';
import { PriceRelayLatestResponse } from '../../data/PriceRelayResponse';
import { RateModel, yieldPerSecondToAPR } from '../../data/RateModel';
import { BoostCardInfo } from '../../data/Uniboost';
import { getValueOfLiquidity, UniswapPosition, UniswapV3GraphQL24HourPoolDataQueryResponse } from '../../data/Uniswap';
import { BOOST_MAX, BOOST_MIN } from '../../pages/boost/ImportBoostPage';
import { getTheGraphClient, Uniswap24HourPoolDataQuery } from '../../util/GraphQL';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  width: 100%;
  border-radius: 8px;
  max-width: 500px;
  text-align: center;
`;

const SliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 300px;
  text-align: center;
  margin: 0 auto;
`;

const StyledDatalist = styled.datalist`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-top: 8px;
  width: 223px;
  margin-left: auto;
  margin-right: auto;

  option {
    color: #ffffff;
    position: relative;
    width: 25px;
  }

  option::before {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: -8px;
    width: 2px;
    height: 4px;
    background-color: #ffffff;
  }
`;

const LeverageSlider = styled.input`
  appearance: none;
  -webkit-appearance: none;
  height: 7px;
  background: #ffffff;
  border-radius: 0px;
  background-repeat: no-repeat;
  width: 200px;
  margin: 0 auto;
  cursor: pointer;

  &::-webkit-slider-thumb {
    position: relative;
    -webkit-appearance: none;
    margin-top: -16px;
    height: 16px;
    width: 4px;
    background: #4197ff;
    z-index: 1;
    cursor: pointer;
  }

  &::-webkit-slider-runnable-track {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    box-shadow: none;
    border: none;
    background: transparent;
  }
`;

type TwentyFourHourPoolData = {
  liquidity: Big;
  feesUSD: number;
};

type TokenQuote = {
  token: Token;
  price: number;
};

enum ImportState {
  READY_TO_APPROVE,
  ASKING_USER_TO_APPROVE,
  APPROVING,
  READY_TO_MINT,
  ASKING_USER_TO_MINT,
  UNABLE_TO_MINT,
  LOADING,
}

function getImportButtonState(state?: ImportState) {
  switch (state) {
    case ImportState.READY_TO_APPROVE:
      return { isDisabled: false, label: 'Approve' };
    case ImportState.ASKING_USER_TO_APPROVE:
      return { isDisabled: true, label: 'Check Wallet' };
    case ImportState.APPROVING:
      return { isDisabled: true, label: 'Approving...' };
    case ImportState.READY_TO_MINT:
      return { isDisabled: false, label: 'Mint' };
    case ImportState.ASKING_USER_TO_MINT:
      return { isDisabled: true, label: 'Check Wallet' };
    case ImportState.UNABLE_TO_MINT:
      return { isDisabled: true, label: 'Unable to Mint' };
    case ImportState.LOADING:
    default:
      return { isDisabled: true, label: 'Loading...' };
  }
}

export type ImportBoostWidgetProps = {
  cardInfo: BoostCardInfo;
  boostFactor: number;
  iv: number;
  setBoostFactor: (boostFactor: number) => void;
  setPendingTxn: (txn: SendTransactionResult | null) => void;
};

export default function ImportBoostWidget(props: ImportBoostWidgetProps) {
  const { cardInfo, boostFactor, iv, setBoostFactor, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [marketInfo, setMarketInfo] = useSafeState<MarketInfo | null>(null);
  const [twentyFourHourPoolData, setTwentyFourHourPoolData] = useSafeState<TwentyFourHourPoolData | undefined>(
    undefined
  );
  const [tokenQuotes, setTokenQuotes] = useSafeState<TokenQuote[] | undefined>(undefined);
  const [availableNft, setAvailableNft] = useChainDependentState<{ borrower: Address; ptrIdx: number } | undefined>(
    undefined,
    activeChain.id
  );

  const provider = useProvider({ chainId: activeChain.id });
  const { address: userAddress } = useAccount();

  // Generate labels for input range (slider)
  const labels: string[] = [];
  for (let i = BOOST_MIN; i <= BOOST_MAX; i += 1) {
    if (i % 2 !== 0) {
      labels.push(`${i.toFixed(0)}x`);
    } else {
      labels.push('');
    }
  }

  useEffect(() => {
    (async () => {
      let quoteDataResponse: AxiosResponse<PriceRelayLatestResponse>;
      try {
        quoteDataResponse = await axios.get(
          `${API_PRICE_RELAY_LATEST_URL}?symbols=${cardInfo.token0.symbol},${cardInfo.token1.symbol}`
        );
      } catch {
        return;
      }
      const prResponse: PriceRelayLatestResponse = quoteDataResponse.data;
      if (!prResponse) {
        return;
      }
      const tokenQuoteData: TokenQuote[] = Object.entries(prResponse).map(([key, value]) => {
        return {
          token: getTokenBySymbol(activeChain.id, key),
          price: value.price,
        };
      });
      setTokenQuotes(tokenQuoteData);
    })();
  }, [activeChain.id, cardInfo.token0.symbol, cardInfo.token1.symbol, setTokenQuotes]);

  useEffect(() => {
    async function fetchMarketInfo() {
      // Checking each of these individually since we don't want to fetch market info when the boost factor changes
      if (!provider || !cardInfo.lender0 || !cardInfo.lender1 || !cardInfo.token0 || !cardInfo.token1) return;
      const lenderLensContract = new ethers.Contract(
        ALOE_II_LENDER_LENS_ADDRESS[activeChain.id],
        lenderLensAbi,
        provider
      );
      const marketInfo = await fetchMarketInfoFor(
        lenderLensContract,
        cardInfo.lender0,
        cardInfo.lender1,
        cardInfo.token0.decimals,
        cardInfo.token1.decimals
      );
      setMarketInfo(marketInfo);
    }
    fetchMarketInfo();
  }, [activeChain.id, cardInfo.lender0, cardInfo.lender1, cardInfo.token0, cardInfo.token1, provider, setMarketInfo]);

  const { data: marketParameters } = useContractRead({
    abi: factoryAbi,
    address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
    functionName: 'getParameters',
    args: [cardInfo.uniswapPool],
    chainId: activeChain.id,
  });

  const borrowAmount0 = GN.fromNumber(cardInfo.amount0() * (boostFactor - 1), cardInfo.token0.decimals);
  const borrowAmount1 = GN.fromNumber(cardInfo.amount1() * (boostFactor - 1), cardInfo.token1.decimals);

  const { apr0, apr1 } = useMemo(() => {
    if (!marketInfo) {
      return { apr0: null, apr1: null };
    }

    const availableAssets0 = marketInfo.lender0AvailableAssets;
    const availableAssets1 = marketInfo.lender1AvailableAssets;
    const remainingAvailableAssets0 = availableAssets0.sub(borrowAmount0);
    const remainingAvailableAssets1 = availableAssets1.sub(borrowAmount1);

    const lenderTotalAssets0 = marketInfo.lender0TotalAssets;
    const lenderTotalAssets1 = marketInfo.lender1TotalAssets;

    const newUtilization0 = lenderTotalAssets0.isGtZero()
      ? 1 - remainingAvailableAssets0.div(lenderTotalAssets0).toNumber()
      : 0;

    const newUtilization1 = lenderTotalAssets1.isGtZero()
      ? 1 - remainingAvailableAssets1.div(lenderTotalAssets1).toNumber()
      : 0;

    const apr0 = yieldPerSecondToAPR(RateModel.computeYieldPerSecond(newUtilization0)) * 100;
    const apr1 = yieldPerSecondToAPR(RateModel.computeYieldPerSecond(newUtilization1)) * 100;
    return { apr0, apr1 };
  }, [marketInfo, borrowAmount0, borrowAmount1]);

  useEffect(() => {
    (async () => {
      const theGraphClient = getTheGraphClient(activeChain.id);
      const unixTwoDaysAgo = Math.floor(Date.now() / 1000) - 86400 * 2;
      const initialQueryResponse = (await theGraphClient.query({
        query: Uniswap24HourPoolDataQuery,
        variables: {
          poolAddress: cardInfo.uniswapPool.toLowerCase(),
          date: unixTwoDaysAgo,
        },
        errorPolicy: 'ignore',
      })) as ApolloQueryResult<UniswapV3GraphQL24HourPoolDataQueryResponse>;
      if (initialQueryResponse.data.poolDayDatas) {
        const poolDayData = initialQueryResponse.data.poolDayDatas[0];
        setTwentyFourHourPoolData({
          liquidity: new Big(poolDayData.liquidity),
          feesUSD: parseInt(poolDayData.feesUSD),
        });
      }
    })();
  }, [activeChain.id, cardInfo, setTwentyFourHourPoolData]);

  const dailyInterestUSD = useMemo(() => {
    if (apr0 == null || apr1 == null || !tokenQuotes) {
      return null;
    }
    const dailyInterest0 = (apr0 / 365) * (cardInfo.amount0() * (boostFactor - 1));
    const dailyInterest1 = (apr1 / 365) * (cardInfo.amount1() * (boostFactor - 1));
    const dailyInterestUSD0 = dailyInterest0 * tokenQuotes[0].price;
    const dailyInterestUSD1 = dailyInterest1 * tokenQuotes[1].price;
    return dailyInterestUSD0 + dailyInterestUSD1;
  }, [apr0, apr1, boostFactor, cardInfo, tokenQuotes]);

  const nftTokenId = ethers.BigNumber.from(cardInfo.nftTokenId);
  const modifyData = useMemo(() => {
    if (!cardInfo) return undefined;
    const { position } = cardInfo;
    const inner = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'int24', 'int24', 'uint128', 'uint24'],
      [
        cardInfo.nftTokenId,
        position.lower,
        position.upper,
        position.liquidity.toString(10),
        (boostFactor * 10000).toFixed(0),
      ]
    ) as `0x${string}`;
    const actionId = 0;
    return ethers.utils.defaultAbiCoder.encode(['uint8', 'bytes'], [actionId, inner]) as `0x${string}`;
  }, [cardInfo, boostFactor]);
  const enableHooks = cardInfo !== undefined;

  // Read who the manager is supposed to be
  const necessaryManager = ALOE_II_BOOST_MANAGER_ADDRESS[activeChain.id];

  // Read who is approved to manage this Uniswap NFT
  const {
    data: manager,
    refetch: refetchManager,
    isFetching: isFetchingManager,
  } = useContractRead({
    address: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[activeChain.id],
    abi: erc721ABI,
    functionName: 'getApproved',
    args: [nftTokenId],
    chainId: activeChain.id,
    enabled: enableHooks,
  });
  const managerIsCorrect = Boolean(manager) && manager === necessaryManager;
  const shouldWriteManager = !isFetchingManager && Boolean(manager) && !managerIsCorrect;
  const shouldMint = !isFetchingManager && Boolean(modifyData) && managerIsCorrect;

  // We need the Boost Manager to be approved, so if it's not, prepare to write
  const { config: configWriteManager } = usePrepareContractWrite({
    address: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[activeChain.id],
    abi: erc721ABI,
    functionName: 'approve',
    args: [necessaryManager ?? '0x', nftTokenId],
    chainId: activeChain.id,
    enabled: enableHooks && shouldWriteManager,
  });
  let gasLimit = configWriteManager.request?.gasLimit.mul(110).div(100);
  const {
    write: writeManager,
    data: writeManagerTxn,
    isLoading: isAskingUserToWriteManager,
  } = useContractWrite({
    ...configWriteManager,
    request: {
      ...configWriteManager.request,
      gasLimit,
    },
  });

  // Wait for the approval transaction to go through, then refetch manager
  const { isLoading: isWritingManager } = useWaitForTransaction({
    confirmations: 1,
    hash: writeManagerTxn?.hash,
    chainId: activeChain.id,
    onSuccess() {
      refetchManager();
    },
  });

  // The NFT index we will use if minting
  const { data: nextNftPtrIdx } = useContractRead({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'balanceOf',
    args: [userAddress ?? '0x'],
    chainId: activeChain.id,
    enabled: enableHooks && Boolean(userAddress),
  });

  // The NFT indices we can use if the user has some unused BorrowerNFTs
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!userAddress) return;
      const chainId = (await provider.getNetwork()).chainId;
      const results = await fetchListOfBorrowerNfts(chainId, provider, userAddress, {
        validUniswapPool: cardInfo.uniswapPool,
        onlyCheckMostRecentModify: true,
        includeFreshBorrowers: true,
      });

      if (mounted && results.borrowers.length > 0) {
        setAvailableNft({ borrower: results.borrowers[0], ptrIdx: results.indices[0] });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [provider, userAddress, cardInfo, setAvailableNft]);

  // If we're reusing an old NFT, check whether it has ANTE
  const { data: borrowerBalance } = useBalance({
    address: availableNft?.borrower ?? '0x',
    chainId: activeChain.id,
    watch: false,
    enabled: availableNft !== undefined,
  });

  const ethToSend = useMemo(() => {
    if (!marketParameters) {
      return ethers.BigNumber.from(0);
    }
    if (availableNft !== undefined && borrowerBalance !== undefined) {
      if (borrowerBalance.value.lt(marketParameters.ante)) return marketParameters.ante.sub(borrowerBalance.value);
      return ethers.BigNumber.from(0);
    }
    return marketParameters.ante;
  }, [marketParameters, availableNft, borrowerBalance]);

  // Prepare for actual import/mint transaction
  const borrowerNft = useMemo(() => new ethers.utils.Interface(borrowerNftAbi), []);
  // First, we `mint` so that they have a `Borrower` to put stuff in
  const encodedMint = useMemo(() => {
    if (!userAddress) return '0x';
    const to = userAddress;
    const pools = [cardInfo.uniswapPool];
    const salts = [generateBytes12Salt()];
    return borrowerNft.encodeFunctionData('mint', [to, pools, salts]) as `0x${string}`;
  }, [borrowerNft, userAddress, cardInfo]);
  // Then we `modify`, calling the BoostManager to import the Uniswap position
  const encodedModify = useMemo(() => {
    if (!userAddress || nextNftPtrIdx === undefined) return '0x';
    const owner = userAddress;
    const indices = [availableNft !== undefined ? availableNft.ptrIdx : nextNftPtrIdx];
    const managers = [ALOE_II_BOOST_MANAGER_ADDRESS[activeChain.id]];
    const datas = [modifyData];
    const antes = [ethToSend.div(1e13)];
    return borrowerNft.encodeFunctionData('modify', [owner, indices, managers, datas, antes]) as `0x${string}`;
  }, [borrowerNft, userAddress, activeChain, availableNft, nextNftPtrIdx, modifyData, ethToSend]);

  const {
    config: configMint,
    isError: isUnableToMint,
    isLoading: isCheckingIfAbleToMint,
  } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'multicall',
    args: [availableNft !== undefined ? [encodedModify] : [encodedMint, encodedModify]],
    overrides: { value: ethToSend },
    chainId: activeChain.id,
    enabled: userAddress && enableHooks && shouldMint && Boolean(encodedMint) && Boolean(encodedModify),
  });
  gasLimit = configMint.request?.gasLimit.mul(110).div(100);
  const { write: mint, isLoading: isAskingUserToMint } = useContractWrite({
    ...configMint,
    request: {
      ...configMint.request,
      gasLimit,
    },
    onSuccess(data) {
      setPendingTxn(data);
    },
  });

  const dailyFeesEarned = useMemo(() => {
    if (!twentyFourHourPoolData || !cardInfo) return null;
    if (!cardInfo.isInRange()) return 0;

    const { liquidity } = cardInfo.position;
    const userLiquidity = new Big(liquidity.toString());
    const { liquidity: totalLiquidity, feesUSD } = twentyFourHourPoolData;
    return userLiquidity.div(totalLiquidity).toNumber() * feesUSD * boostFactor;
  }, [twentyFourHourPoolData, cardInfo, boostFactor]);

  const dailyILSuffered = useMemo(() => {
    if (!cardInfo || !tokenQuotes) return null;

    const log10001E = Math.log(Math.E) / Math.log(1.0001);
    const tick24hLow = Math.max(cardInfo.currentTick - 3 * iv * log10001E, TickMath.MIN_TICK + 1);
    const tick24hHigh = Math.min(cardInfo.currentTick + 3 * iv * log10001E, TickMath.MAX_TICK - 1);

    const position: UniswapPosition = {
      lower: cardInfo.position.lower,
      upper: cardInfo.position.upper,
      liquidity: JSBI.divide(
        JSBI.multiply(cardInfo.position.liquidity, JSBI.BigInt((boostFactor * 10000).toFixed(0))),
        JSBI.BigInt(10000)
      ),
    };

    const valueCurrent = getValueOfLiquidity(position, cardInfo.currentTick, cardInfo.token1.decimals);
    const value24hLow = getValueOfLiquidity(position, Math.round(tick24hLow), cardInfo.token1.decimals);
    const value24hHigh = getValueOfLiquidity(position, Math.round(tick24hHigh), cardInfo.token1.decimals);

    const lossEstimate = valueCurrent - Math.min(value24hLow, value24hHigh);
    return lossEstimate * tokenQuotes[1].price;
  }, [cardInfo, tokenQuotes, boostFactor, iv]);

  let state: ImportState = ImportState.LOADING;
  if (isWritingManager) {
    state = ImportState.APPROVING;
  } else if (isAskingUserToWriteManager) {
    state = ImportState.ASKING_USER_TO_APPROVE;
  } else if (isAskingUserToMint) {
    state = ImportState.ASKING_USER_TO_MINT;
  } else if (shouldWriteManager && writeManager) {
    state = ImportState.READY_TO_APPROVE;
  } else if (isUnableToMint) {
    state = ImportState.UNABLE_TO_MINT;
  } else if (isCheckingIfAbleToMint) {
    state = ImportState.LOADING;
  } else if (shouldMint && mint) {
    state = ImportState.READY_TO_MINT;
  }

  const buttonState = getImportButtonState(state);

  return (
    <Container>
      <Text size='L'>Boost Factor</Text>
      <SliderContainer>
        <Display size='M'>{`${boostFactor}x`}</Display>
        <LeverageSlider
          type='range'
          list='boost-factor-labels'
          min={BOOST_MIN}
          max={BOOST_MAX}
          step={0.1}
          value={boostFactor}
          onChange={(e) => setBoostFactor(Number(e.target.value))}
        />
        <StyledDatalist id='boost-factor-labels'>
          {labels.map((label, i) => (
            <option key={i} value={i + 1} label={label}></option>
          ))}
        </StyledDatalist>
      </SliderContainer>
      <Text size='M' color={SECONDARY_COLOR} className='mt-4'>
        Estimated Earnings
      </Text>
      <div className='flex justify-center gap-2 mt-2'>
        <div className='flex flex-row justify-center items-end'>
          <Display size='S' color={SECONDARY_COLOR}>
            {formatUSD(dailyFeesEarned)}
          </Display>
          <Text size='S' color={SECONDARY_COLOR} className='ml-1'>
            / day
          </Text>
        </div>
      </div>
      <div className='flex flex-row justify-center gap-12'>
        <div className='flex flex-col justify-center gap-2 mt-6'>
          <Text size='M' color={SECONDARY_COLOR}>
            3σ IL
          </Text>
          <div className='flex flex-row justify-center items-end'>
            <Display size='S' color={SECONDARY_COLOR}>
              -{formatUSD(dailyILSuffered)}
            </Display>
            <Text size='S' color={SECONDARY_COLOR} className='ml-1'>
              / day
            </Text>
          </div>
        </div>
        <div className='flex flex-col justify-center gap-2 mt-6'>
          <Text size='M' color={SECONDARY_COLOR}>
            Estimated Interest
          </Text>
          <div className='flex flex-row justify-center items-end'>
            <Display size='S' color={SECONDARY_COLOR}>
              -{formatUSD(dailyInterestUSD)}
            </Display>
            <Text size='S' color={SECONDARY_COLOR} className='ml-1'>
              / day
            </Text>
          </div>
        </div>
      </div>
      <div className='mt-6 mx-6'>
        <div className='flex flex-col gap-1 w-full text-start mb-4'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='w-full text-start overflow-hidden text-ellipsis'>
            You're moving liquidity from a Uniswap NFT to an Aloe NFT and applying a{' '}
            <strong>{boostFactor}x boost</strong>. As a result, you will earn swap fees {boostFactor}x faster, but also
            pay interest to Aloe lenders and risk liquidation. Liquidation thresholds are indicated with (!) in the
            graph to the left.
          </Text>
          <Text size='XS' color={TERTIARY_COLOR} className='overflow-hidden text-ellipsis'>
            You will need to provide an additional {GN.fromBigNumber(ethToSend, 18).toString(GNFormat.LOSSY_HUMAN)} ETH
            to cover gas fees in the event that you get liquidated. If you don't get liquidated, the ETH will be
            returned to you when you close the position.
          </Text>
        </div>
        <FilledGradientButton
          size='M'
          onClick={() => {
            if (state === ImportState.READY_TO_APPROVE) {
              writeManager?.();
            } else if (state === ImportState.READY_TO_MINT) {
              mint?.();
            }
          }}
          disabled={buttonState.isDisabled}
          fillWidth={true}
        >
          {buttonState.label}
        </FilledGradientButton>
        <Text size='XS' color={TERTIARY_COLOR} className='w-full text-start mt-2'>
          By using our service, you agree to our{' '}
          <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
            Terms of Service
          </a>{' '}
          and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
          your duty to educate yourself and be aware of the risks.
        </Text>
      </div>
    </Container>
  );
}
