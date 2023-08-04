import { useContext, useEffect, useMemo, useState } from 'react';

import JSBI from 'jsbi';
import { UniswapV3PoolABI } from 'shared/lib/abis/UniswapV3Pool';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGradientButton, FilledGreyButton } from 'shared/lib/components/common/Buttons';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { formatTokenAmount, roundPercentage, toBig } from 'shared/lib/util/Numbers';
import { useAccount, useContractReads, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import LiquidityChart from '../components/boost/LiquidityChart';
import TokenPairIcons from '../components/common/TokenPairIcons';
import {
  InRangeBadge,
  OutOfRangeBadge,
  UniswapPositionCardContainer,
  UniswapPositionCardWrapper,
} from '../components/common/UniswapPositionCard';
import { sqrtRatioToPrice } from '../data/BalanceSheet';
import {
  UniswapNFTPosition,
  UniswapPosition,
  computePoolAddress,
  fetchUniswapNFTPositions,
  getAmountsForLiquidity,
  tickToPrice,
} from '../data/Uniswap';

const ACCENT_COLOR = 'rgba(130, 160, 182, 1)';

export default function BoostPage() {
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider({ chainId: activeChain.id });
  const { address: userAddress } = useAccount();

  const [uniswapNFTPositions, setUniswapNFTPositions] = useState<Map<number, UniswapNFTPosition>>(new Map());

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (userAddress === undefined) return;
      const fetchedUniswapNFTPositions = await fetchUniswapNFTPositions(userAddress, provider, activeChain);
      if (mounted) {
        setUniswapNFTPositions(fetchedUniswapNFTPositions);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [activeChain, provider, userAddress]);

  const nonZeroUniswapNFTPositions = useMemo(() => {
    return Array.from(uniswapNFTPositions.values()).filter((position) => {
      return JSBI.greaterThan(position.liquidity, JSBI.BigInt(0));
    });
  }, [uniswapNFTPositions]);

  const contracts = useMemo(() => {
    return nonZeroUniswapNFTPositions.map((position) => {
      return {
        abi: UniswapV3PoolABI,
        address: computePoolAddress(position),
        functionName: 'slot0',
        chainId: activeChain.id,
      } as const;
    });
  }, [activeChain.id, nonZeroUniswapNFTPositions]);

  const { data: slot0Data } = useContractReads({
    contracts: contracts,
    allowFailure: false,
  });

  const uniswapNFTCardInfo = useMemo(() => {
    if (slot0Data === undefined || slot0Data.length !== nonZeroUniswapNFTPositions.length) {
      return [];
    }
    return nonZeroUniswapNFTPositions.map((position, index) => {
      const { token0, token1, tickLower, tickUpper } = position;

      const minPrice = tickToPrice(tickLower, token0.decimals, token1.decimals, true);

      const maxPrice = tickToPrice(tickUpper, token0.decimals, token1.decimals, true);

      const sqrtPriceX96 = slot0Data[index][0];
      const currentTick = slot0Data[index][1];

      const uniswapPosition: UniswapPosition = {
        lower: tickLower,
        upper: tickUpper,
        liquidity: position.liquidity,
      };

      const [amount0, amount1] = getAmountsForLiquidity(uniswapPosition, currentTick, token0.decimals, token1.decimals);

      const token0PerToken1 = sqrtRatioToPrice(toBig(sqrtPriceX96), token0.decimals, token1.decimals);
      const amount0InTermsOfToken1 = amount0 * token0PerToken1;
      const totalValue = amount0InTermsOfToken1 + amount1;

      const amount0Percent = totalValue > 0 ? (amount0InTermsOfToken1 / totalValue) * 100 : 0;
      const amount1Percent = totalValue > 0 ? (amount1 / totalValue) * 100 : 0;

      const isInRange = uniswapPosition && currentTick >= uniswapPosition.lower && currentTick <= uniswapPosition.upper;

      const isDeposit = Math.random() > 0.5; // TODO: figure out how to determine if this is a deposit or withdrawal

      const poolAddress = computePoolAddress(position);
      const currentPrice = sqrtRatioToPrice(toBig(sqrtPriceX96), token0.decimals, token1.decimals);

      return {
        token0: token0,
        token1: token1,
        minPrice: minPrice,
        maxPrice: maxPrice,
        amount0: amount0,
        amount1: amount1,
        amount0Percent: amount0Percent,
        amount1Percent: amount1Percent,
        isInRange: isInRange,
        isDeposit: isDeposit,
        poolAddress: poolAddress,
        currentPrice: currentPrice,
      };
    });
  }, [nonZeroUniswapNFTPositions, slot0Data]);

  return (
    <AppPage>
      <Text size='XL'>Boost</Text>
      <div className='flex flex-wrap gap-4 mt-4'>
        {uniswapNFTCardInfo.map((position, index) => {
          const {
            token0,
            token1,
            minPrice,
            maxPrice,
            amount0,
            amount1,
            amount0Percent,
            amount1Percent,
            isInRange,
            isDeposit,
          } = position;

          return (
            <UniswapPositionCardContainer key={index}>
              <UniswapPositionCardWrapper>
                <div className='flex flex-col gap-4'>
                  <div className='flex justify-center items-center'>
                    <TokenPairIcons
                      token0IconPath={token0.logoURI}
                      token1IconPath={token1.logoURI}
                      token0AltText={`${token0.symbol}'s icon`}
                      token1AltText={`${token1.symbol}'s icon`}
                    />
                  </div>
                  <div className='flex justify-between'>
                    <div className='text-left'>
                      <Display size='XS' color={ACCENT_COLOR}>
                        {roundPercentage(amount0Percent, 1)}%
                      </Display>
                      <Display size='S'>{formatTokenAmount(amount0, 5)}</Display>
                      <Text size='XS'>{token0.symbol}</Text>
                    </div>
                    <div className='text-right'>
                      <Display size='XS' color={ACCENT_COLOR}>
                        {roundPercentage(amount1Percent, 1)}%
                      </Display>
                      <Display size='S'>{formatTokenAmount(amount1, 5)}</Display>
                      <Text size='XS'>{token1.symbol}</Text>
                    </div>
                  </div>
                  <div className='flex justify-between'>
                    <div className='text-left'>
                      <Text size='S' color={ACCENT_COLOR}>
                        Min Price
                      </Text>
                      <Display size='S'>{formatTokenAmount(minPrice, 5)}</Display>
                      <Text size='XS'>
                        {token1.symbol} per {token0.symbol}
                      </Text>
                    </div>
                    <div className='text-right'>
                      <Text size='S' color={ACCENT_COLOR}>
                        Max Price
                      </Text>
                      <Display size='S'>{formatTokenAmount(maxPrice, 5)}</Display>
                      <Text size='XS'>
                        {token1.symbol} per {token0.symbol}
                      </Text>
                    </div>
                  </div>
                  <div className='flex justify-between'>
                    {isInRange ? <InRangeBadge /> : <OutOfRangeBadge />}
                    {isDeposit ? (
                      <FilledGradientButton size='S' onClick={() => {}}>
                        Lever Up
                      </FilledGradientButton>
                    ) : (
                      <FilledGreyButton size='S' onClick={() => {}}>
                        Manage
                      </FilledGreyButton>
                    )}
                  </div>
                </div>
                <LiquidityChart
                  poolAddress={position.poolAddress}
                  minPrice={position.minPrice}
                  maxPrice={position.maxPrice}
                  currentPrice={position.currentPrice}
                />
              </UniswapPositionCardWrapper>
            </UniswapPositionCardContainer>
          );
        })}
      </div>
    </AppPage>
  );
}
