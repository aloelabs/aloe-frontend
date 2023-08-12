import { useContext, useEffect, useMemo, useState } from 'react';

import JSBI from 'jsbi';
import { UniswapV3PoolABI } from 'shared/lib/abis/UniswapV3Pool';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { GN } from 'shared/lib/data/GoodNumber';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { Address, useAccount, useContractReads, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import BoostCard from '../components/boost/BoostCard';
import { BoostCardPlaceholder } from '../components/boost/BoostCardPlaceholder';
import ImportModal from '../components/boost/ImportModal';
import ManageBoostModal from '../components/boost/ManageBoostModal';
import { sqrtRatioToTick } from '../data/BalanceSheet';
import { BoostCardInfo, BoostCardType, fetchBoostBorrower, fetchBoostBorrowersList } from '../data/Uniboost';
import { UniswapNFTPosition, computePoolAddress, fetchUniswapNFTPositions } from '../data/Uniswap';
import { getProminentColor, rgb } from '../util/Colors';

const DEFAULT_COLOR0 = 'white';
const DEFAULT_COLOR1 = 'white';

export default function BoostPage() {
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider({ chainId: activeChain.id });
  const { address: userAddress } = useAccount();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [boostedCardInfos, setBoostedCardInfos] = useChainDependentState<BoostCardInfo[]>([], activeChain.id);
  const [uniswapNFTPositions, setUniswapNFTPositions] = useChainDependentState<UniswapNFTPosition[]>(
    [],
    activeChain.id
  );
  const [colors, setColors] = useState<Map<string, string>>(new Map());
  const [selectedPosition, setSelectedPosition] = useChainDependentState<number | null>(null, activeChain.id);

  /*//////////////////////////////////////////////////////////////
                      FETCH BOOSTED CARD INFOS
  //////////////////////////////////////////////////////////////*/
  useEffect(() => {
    (async () => {
      if (userAddress === undefined) return;
      const { borrowers, tokenIds } = await fetchBoostBorrowersList(activeChain, provider, userAddress);

      const fetchedInfos = await Promise.all(
        borrowers.map(async (borrowerAddress, i) => {
          const res = await fetchBoostBorrower(activeChain.id, provider, borrowerAddress);
          return new BoostCardInfo(
            BoostCardType.BOOST_NFT,
            tokenIds[i],
            res.borrower.uniswapPool as Address,
            sqrtRatioToTick(res.borrower.sqrtPriceX96),
            res.borrower.token0,
            res.borrower.token1,
            DEFAULT_COLOR0,
            DEFAULT_COLOR1,
            res.uniswapPosition,
            res.uniswapFees,
            res.borrower
          );
        })
      );

      setBoostedCardInfos(fetchedInfos);
    })();

    return () => {};
  }, [activeChain, provider, userAddress]);

  /*//////////////////////////////////////////////////////////////
                    FETCH UNISWAP NFT POSITIONS
  //////////////////////////////////////////////////////////////*/
  useEffect(() => {
    setIsLoading(true);
  }, [activeChain.id]);

  /*//////////////////////////////////////////////////////////////
                      FETCH BOOSTED CARD INFOS
  //////////////////////////////////////////////////////////////*/
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (userAddress === undefined) return;
      // NOTE: Use chainId from provider instead of `activeChain.id` since one may update before the other
      // when rendering. We want to stay consistent to avoid fetching things from the wrong address.
      const chainId = (await provider.getNetwork()).chainId;
      const { borrowers, tokenIds } = await fetchBoostBorrowersList(chainId, provider, userAddress);

      const fetchedInfos = await Promise.all(
        borrowers.map(async (borrowerAddress, i) => {
          const res = await fetchBoostBorrower(chainId, provider, borrowerAddress);
          return new BoostCardInfo(
            BoostCardType.BOOST_NFT,
            tokenIds[i],
            res.borrower.uniswapPool as Address,
            sqrtRatioToTick(res.borrower.sqrtPriceX96),
            res.borrower.token0,
            res.borrower.token1,
            DEFAULT_COLOR0,
            DEFAULT_COLOR1,
            res.uniswapPosition,
            res.uniswapFees,
            res.borrower
          );
        })
      );

      if (mounted) setBoostedCardInfos(fetchedInfos);
    })();

    return () => {
      mounted = false;
    };
  }, [provider, userAddress, setBoostedCardInfos]);

  /*//////////////////////////////////////////////////////////////
                    FETCH UNISWAP NFT POSITIONS
  //////////////////////////////////////////////////////////////*/
  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (userAddress === undefined) return;
      const fetchedPositionsMap = await fetchUniswapNFTPositions(userAddress, provider);
      const fetchedPositions = Array.from(fetchedPositionsMap.values());
      const nonZeroPositions = fetchedPositions.filter((v) => JSBI.greaterThan(v.liquidity, JSBI.BigInt(0)));

      if (mounted) {
        setUniswapNFTPositions(nonZeroPositions);
        setIsLoading(false);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [activeChain, provider, userAddress, setUniswapNFTPositions]);

  /*//////////////////////////////////////////////////////////////
            FETCH UNISWAP NFT POSITIONS - CONT. (SLOT0)
  //////////////////////////////////////////////////////////////*/
  const poolContracts = useMemo(() => {
    return uniswapNFTPositions.map((position) => {
      return {
        abi: UniswapV3PoolABI,
        address: computePoolAddress(position),
        functionName: 'slot0',
        chainId: activeChain.id,
      } as const;
    });
  }, [activeChain.id, uniswapNFTPositions]);
  const { data: slot0Data } = useContractReads({
    contracts: poolContracts,
    allowFailure: false,
  });

  /*//////////////////////////////////////////////////////////////
                     CREATE UNISWAP CARD INFOS
  //////////////////////////////////////////////////////////////*/
  const uniswapCardInfos: BoostCardInfo[] = useMemo(() => {
    if (slot0Data === undefined || slot0Data.length !== uniswapNFTPositions.length) {
      return [];
    }
    return uniswapNFTPositions.map((position, index) => {
      const currentTick = slot0Data[index]['tick'];

      return new BoostCardInfo(
        BoostCardType.UNISWAP_NFT,
        position.tokenId,
        computePoolAddress(position),
        currentTick,
        position.token0,
        position.token1,
        DEFAULT_COLOR0,
        DEFAULT_COLOR1,
        position,
        // TODO: fetch fees earned for Uniswap NFT
        { amount0: GN.zero(position.token0.decimals), amount1: GN.zero(position.token1.decimals) },
        null
      );
    });
  }, [uniswapNFTPositions, slot0Data]);

  /*//////////////////////////////////////////////////////////////
                           COMPUTE COLORS
  //////////////////////////////////////////////////////////////*/
  useEffect(() => {
    let mounted = true;

    (async () => {
      const merged = boostedCardInfos.concat(uniswapCardInfos);
      const tokenAddresses = Array.from(
        new Set(merged.flatMap((cardInfo) => [cardInfo.token0.logoURI, cardInfo.token1.logoURI])).values()
      );
      const entries = tokenAddresses.map(async (logoUri) => {
        const color = await getProminentColor(logoUri);
        return [logoUri, rgb(color)] as [string, string];
      });

      if (mounted) setColors(new Map(await Promise.all(entries)));
    })();

    return () => {
      mounted = false;
    };
  }, [boostedCardInfos, uniswapCardInfos]);

  /*//////////////////////////////////////////////////////////////
                          MERGE CARD INFOS
  //////////////////////////////////////////////////////////////*/
  const allCardInfos = useMemo(() => {
    const merged = boostedCardInfos.concat(uniswapCardInfos);
    return merged.map(
      (cardInfo) =>
        new BoostCardInfo(
          cardInfo.cardType,
          cardInfo.nftTokenId,
          cardInfo.uniswapPool,
          cardInfo.currentTick,
          cardInfo.token0,
          cardInfo.token1,
          colors.get(cardInfo.token0.logoURI) ?? cardInfo.color0,
          colors.get(cardInfo.token1.logoURI) ?? cardInfo.color1,
          cardInfo.position,
          cardInfo.feesEarned,
          cardInfo.borrower
        )
    );
  }, [boostedCardInfos, uniswapCardInfos, colors]);

  const selectedCardInfo = useMemo(() => {
    if (selectedPosition === null) return undefined;
    return allCardInfos[selectedPosition];
  }, [selectedPosition, allCardInfos]);

  const getUniqueId = (info: BoostCardInfo) => {
    return info.uniswapPool.concat(
      info.borrower?.address ?? '',
      info.position.lower.toString(),
      info.position.upper.toString()
    );
  };

  return (
    <AppPage>
      <Text size='XL'>Boost</Text>
      <div className='flex flex-wrap gap-4 mt-4'>
        {isLoading &&
          allCardInfos.length === 0 &&
          [...Array(4)].map((_, index) => <BoostCardPlaceholder key={index} />)}
        {allCardInfos.map((info, index) => {
          const uniqueId = getUniqueId(info);
          return (
            <BoostCard
              key={uniqueId}
              info={info}
              uniqueId={uniqueId}
              setSelectedPosition={() => setSelectedPosition(index)}
            />
          );
        })}
      </div>
      <ImportModal
        isOpen={selectedPosition !== null && selectedCardInfo?.cardType === BoostCardType.UNISWAP_NFT}
        uniqueId={selectedCardInfo ? getUniqueId(selectedCardInfo) : ''}
        setIsOpen={() => {
          setSelectedPosition(null);
        }}
        cardInfo={selectedCardInfo}
      />
      <ManageBoostModal
        isOpen={selectedPosition !== null && selectedCardInfo?.cardType === BoostCardType.BOOST_NFT}
        uniqueId={selectedCardInfo ? getUniqueId(selectedCardInfo) : ''}
        setIsOpen={() => {
          setSelectedPosition(null);
        }}
        uniswapNFTCardInfo={selectedCardInfo}
      />
    </AppPage>
  );
}
