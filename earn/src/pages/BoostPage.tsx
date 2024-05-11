import { useContext, useEffect, useMemo } from 'react';

import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { uniswapV3PoolAbi } from 'shared/lib/abis/UniswapV3Pool';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_FACTORY_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN } from 'shared/lib/data/GoodNumber';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import useSafeState from 'shared/lib/data/hooks/UseSafeState';
import styled from 'styled-components';
import { Address } from 'viem';
import { Config, useAccount, useClient, useReadContracts } from 'wagmi';

import { ChainContext } from '../App';
import BoostCard from '../components/boost/BoostCard';
import { BoostCardPlaceholder } from '../components/boost/BoostCardPlaceholder';
import NoPositions from '../components/boost/NoPositions';
import { sqrtRatioToTick } from '../data/BalanceSheet';
import { BoostCardInfo, BoostCardType, fetchBoostBorrower, fetchBoostBorrowersList } from '../data/Uniboost';
import { UniswapNFTPosition, computePoolAddress, fetchUniswapNFTPositions } from '../data/Uniswap';
import { getProminentColor, rgb } from '../util/Colors';
import { useEthersProvider } from '../util/Provider';

const DEFAULT_COLOR0 = 'white';
const DEFAULT_COLOR1 = 'white';
const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

const ExplainerWrapper = styled.div`
  display: flex;
  flex-direction: row;
  position: relative;

  padding: 16px;
  margin-top: 1rem;
  margin-bottom: 2rem;

  background-color: rgba(10, 20, 27, 1);
  border-radius: 8px;

  &:before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: 8px;
    /* 1.25px instead of 1px since it avoids the buggy appearance */
    padding: 1.25px;
    background: linear-gradient(90deg, #9baaf3 0%, #7bd8c0 100%);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  }
`;

export const BackButtonWrapper = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  color: ${SECONDARY_COLOR};
  svg {
    width: 24px;
    height: 24px;
    path {
      stroke: ${SECONDARY_COLOR};
    }
  }

  &:hover {
    color: white;
    svg {
      path {
        stroke: rgb(255, 255, 255);
      }
    }
  }
`;

export default function BoostPage() {
  const { activeChain } = useContext(ChainContext);

  const { address: userAddress } = useAccount();
  const client = useClient<Config>({ chainId: activeChain.id });
  const provider = useEthersProvider(client);

  const [isLoading, setIsLoading] = useSafeState<boolean>(true);
  const [isLoadingBoostedCardInfos, setIsLoadingBoostedCardInfos] = useSafeState<boolean>(true);
  const [initialBoostedCardInfos, setInitialBoostedCardInfos] = useChainDependentState<BoostCardInfo[]>(
    [],
    activeChain.id
  );
  const [uniswapNFTPositions, setUniswapNFTPositions] = useChainDependentState<UniswapNFTPosition[]>(
    [],
    activeChain.id
  );
  const [colors, setColors] = useSafeState<Map<string, string>>(new Map());

  useEffect(() => {
    setIsLoading(true);
    setIsLoadingBoostedCardInfos(true);
  }, [activeChain.id, setIsLoading, setIsLoadingBoostedCardInfos]);

  /*//////////////////////////////////////////////////////////////
                      FETCH BOOSTED CARD INFOS
  //////////////////////////////////////////////////////////////*/
  useEffect(() => {
    (async () => {
      if (userAddress === undefined || provider === undefined) return;
      // NOTE: Use chainId from provider instead of `activeChain.id` since one may update before the other
      // when rendering. We want to stay consistent to avoid fetching things from the wrong address.
      const chainId = (await provider.getNetwork()).chainId;
      const borrowerNfts = await fetchBoostBorrowersList(chainId, provider, userAddress);

      const fetchedInfos = await Promise.all(
        borrowerNfts.map(async (borrowerNft) => {
          const res = await fetchBoostBorrower(chainId, provider, borrowerNft.borrowerAddress);
          return new BoostCardInfo(
            BoostCardType.BOOST_NFT,
            userAddress,
            borrowerNft.tokenId,
            borrowerNft.index,
            res.borrower.uniswapPool as Address,
            sqrtRatioToTick(res.borrower.sqrtPriceX96),
            res.borrower.token0,
            res.borrower.token1,
            res.borrower.lender0,
            res.borrower.lender1,
            DEFAULT_COLOR0,
            DEFAULT_COLOR1,
            res.uniswapPosition,
            res.uniswapFees,
            res.borrower
          );
        })
      );

      const filteredInfos = fetchedInfos.filter((info) => JSBI.greaterThan(info.position.liquidity, JSBI.BigInt(0)));

      setInitialBoostedCardInfos(filteredInfos);
      setIsLoadingBoostedCardInfos(false);
    })();
  }, [provider, userAddress, setInitialBoostedCardInfos, setIsLoadingBoostedCardInfos]);

  /*//////////////////////////////////////////////////////////////
                    FETCH UNISWAP NFT POSITIONS
  //////////////////////////////////////////////////////////////*/
  useEffect(() => {
    (async () => {
      if (userAddress === undefined || provider === undefined) return;
      const fetchedPositionsMap = await fetchUniswapNFTPositions(userAddress, provider);
      const fetchedPositions = Array.from(fetchedPositionsMap.values());
      const nonZeroPositions = fetchedPositions.filter((v) => JSBI.greaterThan(v.liquidity, JSBI.BigInt(0)));

      setUniswapNFTPositions(nonZeroPositions);
      setIsLoading(false);
    })();
  }, [activeChain, provider, userAddress, setUniswapNFTPositions, setIsLoading]);

  /*//////////////////////////////////////////////////////////////
            FETCH UNISWAP NFT POSITIONS - CONT. (SLOT0)
  //////////////////////////////////////////////////////////////*/
  const poolContracts = useMemo(() => {
    return uniswapNFTPositions.map((position) => {
      return {
        abi: uniswapV3PoolAbi,
        address: computePoolAddress({ ...position, chainId: activeChain.id }),
        functionName: 'slot0',
        chainId: activeChain.id,
      } as const;
    });
  }, [activeChain.id, uniswapNFTPositions]);
  const { data: slot0Data } = useReadContracts({
    contracts: poolContracts,
    allowFailure: false,
  });

  const factoryContracts = useMemo(() => {
    return uniswapNFTPositions.map((position) => {
      return {
        abi: factoryAbi,
        address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
        functionName: 'getMarket',
        args: [computePoolAddress({ ...position, chainId: activeChain.id })],
        chainId: activeChain.id,
      } as const;
    });
  }, [activeChain.id, uniswapNFTPositions]);
  const { data: marketDatas } = useReadContracts({
    contracts: factoryContracts,
    allowFailure: false,
  });

  /*//////////////////////////////////////////////////////////////
                           COMPUTE COLORS
  //////////////////////////////////////////////////////////////*/
  useEffect(() => {
    (async () => {
      const tokenLogos = new Set<string>();
      initialBoostedCardInfos.forEach((cardInfo) => {
        tokenLogos.add(cardInfo.token0.logoURI);
        tokenLogos.add(cardInfo.token1.logoURI);
      });
      uniswapNFTPositions.forEach((position) => {
        tokenLogos.add(position.token0.logoURI);
        tokenLogos.add(position.token1.logoURI);
      });
      const entries = Array.from(tokenLogos).map(async (logoUri) => {
        const color = await getProminentColor(logoUri);
        return [logoUri, rgb(color)] as [string, string];
      });

      setColors(new Map(await Promise.all(entries)));
    })();
  }, [initialBoostedCardInfos, setColors, uniswapNFTPositions]);

  /*//////////////////////////////////////////////////////////////
                     CREATE UNISWAP CARD INFOS
  //////////////////////////////////////////////////////////////*/
  const uniswapCardInfos: BoostCardInfo[] = useMemo(() => {
    if (
      slot0Data === undefined ||
      slot0Data.length !== uniswapNFTPositions.length ||
      marketDatas === undefined ||
      !userAddress
    ) {
      return [];
    }
    return uniswapNFTPositions
      .map((position, index) => {
        const currentTick = slot0Data[index][1];
        const marketData = marketDatas[index];

        return new BoostCardInfo(
          BoostCardType.UNISWAP_NFT,
          userAddress,
          position.tokenId,
          null,
          computePoolAddress({ ...position, chainId: activeChain.id }),
          currentTick,
          position.token0,
          position.token1,
          marketData[0],
          marketData[1],
          colors.get(position.token0.logoURI) ?? DEFAULT_COLOR0,
          colors.get(position.token1.logoURI) ?? DEFAULT_COLOR1,
          position,
          // TODO: fetch fees earned for Uniswap NFT
          { amount0: GN.zero(position.token0.decimals), amount1: GN.zero(position.token1.decimals) },
          null
        );
      })
      .filter((info) => info.lender0 !== ethers.constants.AddressZero || info.lender1 !== ethers.constants.AddressZero);
  }, [slot0Data, uniswapNFTPositions, marketDatas, userAddress, activeChain.id, colors]);

  /*//////////////////////////////////////////////////////////////
                      CREATE BOOSTED CARD INFOS
  //////////////////////////////////////////////////////////////*/
  const boostedCardInfos: BoostCardInfo[] = useMemo(() => {
    return initialBoostedCardInfos.map((info, index) => {
      return BoostCardInfo.withColors(
        info,
        colors.get(info.token0.logoURI) ?? info.color0,
        colors.get(info.token1.logoURI) ?? info.color1
      );
    });
  }, [initialBoostedCardInfos, colors]);

  const getUniqueId = (info: BoostCardInfo) => {
    return info.uniswapPool.concat(
      info.borrower?.address ?? '',
      info.position.lower.toString(),
      info.position.upper.toString()
    );
  };

  return (
    <AppPage>
      <ExplainerWrapper>
        <Text size='M' weight='regular' color={SECONDARY_COLOR}>
          Aloe Boost puts your Uniswap positions on steroids. Earn up to 5x more swap fees with the same capital. Click
          a lightning bolt to get started.
        </Text>
      </ExplainerWrapper>
      <Text size='XL'>Boosted Positions</Text>
      <div className='flex flex-wrap gap-4 mt-4 mb-8'>
        {isLoadingBoostedCardInfos &&
          boostedCardInfos.length === 0 &&
          [...Array(1)].map((_, index) => <BoostCardPlaceholder key={index} />)}
        {boostedCardInfos.map((info) => {
          const uniqueId = getUniqueId(info);
          return <BoostCard key={uniqueId} info={info} uniqueId={uniqueId} />;
        })}
        {!isLoadingBoostedCardInfos && boostedCardInfos.length === 0 && (
          <NoPositions
            primaryText='Your Boosted positions will appear here.'
            secondaryText={`If you have any Uniswap V3 positions that are eligible for boosting,
             they will appear in the section below. You can import positions by clicking on the
             lightning bolt icon in the top right corner.`}
          />
        )}
      </div>
      <Text size='XL'>Uniswap Positions</Text>
      <div className='flex flex-wrap gap-4 mt-4'>
        {isLoading &&
          uniswapCardInfos.length === 0 &&
          [...Array(1)].map((_, index) => <BoostCardPlaceholder key={index} />)}
        {uniswapCardInfos.map((info) => {
          const uniqueId = getUniqueId(info);
          return <BoostCard key={uniqueId} info={info} uniqueId={uniqueId} />;
        })}
        {!isLoading && uniswapCardInfos.length === 0 && (
          <NoPositions
            primaryText='Your Uniswap positions will appear here.'
            secondaryText={`Eligible Uniswap V3 positions will appear in this section.
             You can create positions via the Uniswap interface.`}
          />
        )}
      </div>
    </AppPage>
  );
}
