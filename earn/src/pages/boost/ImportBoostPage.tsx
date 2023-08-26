import { useContext, useEffect, useMemo, useState } from 'react';

import { useParams } from 'react-router-dom';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { UniswapV3PoolABI } from 'shared/lib/abis/UniswapV3Pool';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_FACTORY_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN } from 'shared/lib/data/GoodNumber';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { useContractRead, useProvider } from 'wagmi';

import { ChainContext } from '../../App';
import BoostCard from '../../components/boost/BoostCard';
import { BoostCardInfo, BoostCardType } from '../../data/Uniboost';
import { UniswapNFTPosition, computePoolAddress, fetchUniswapNFTPosition } from '../../data/Uniswap';
import { getProminentColor, rgb } from '../../util/Colors';

const DEFAULT_COLOR0 = 'white';
const DEFAULT_COLOR1 = 'white';

export default function ImportBoostPage() {
  const { activeChain } = useContext(ChainContext);
  const { tokenId } = useParams();
  const provider = useProvider({ chainId: activeChain.id });
  const [uniswapNftPosition, setUniswapNftPosition] = useChainDependentState<UniswapNFTPosition | undefined>(
    undefined,
    activeChain.id
  );
  const [colors, setColors] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!uniswapNftPosition) return;
      const tokenAddresses = [uniswapNftPosition.token0.logoURI, uniswapNftPosition.token1.logoURI];
      const entries = tokenAddresses.map(async (logoUri) => {
        const color = await getProminentColor(logoUri);
        return [logoUri, rgb(color)] as [string, string];
      });
      if (mounted) setColors(new Map(await Promise.all(entries)));
    })();
    return () => {
      mounted = false;
    };
  }, [uniswapNftPosition]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const fetchedUniswapNFTPosition = await fetchUniswapNFTPosition(Number(tokenId), provider);
      if (mounted) {
        setUniswapNftPosition(fetchedUniswapNFTPosition);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [tokenId, provider, setUniswapNftPosition]);

  const poolAddress = useMemo(() => {
    if (!uniswapNftPosition) return undefined;
    return computePoolAddress({
      chainId: activeChain.id,
      token0: uniswapNftPosition.token0,
      token1: uniswapNftPosition.token1,
      fee: uniswapNftPosition.fee,
    });
  }, [uniswapNftPosition, activeChain.id]);

  const { data: slot0 } = useContractRead({
    abi: UniswapV3PoolABI,
    address: poolAddress,
    functionName: 'slot0',
    chainId: activeChain.id,
    enabled: !!poolAddress,
  });

  const { data: marketData } = useContractRead({
    abi: factoryAbi,
    address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
    functionName: 'getMarket',
    args: [poolAddress || '0x'],
    enabled: !!poolAddress,
  });

  const uniswapCardInfo: BoostCardInfo | undefined = useMemo(() => {
    if (!uniswapNftPosition || !poolAddress || !slot0 || !marketData) return undefined;
    const currentTick = slot0.tick;
    return new BoostCardInfo(
      BoostCardType.UNISWAP_NFT,
      uniswapNftPosition.tokenId,
      poolAddress,
      currentTick,
      uniswapNftPosition.token0,
      uniswapNftPosition.token1,
      marketData.lender0,
      marketData.lender1,
      colors.get(uniswapNftPosition.token0.address) || DEFAULT_COLOR0,
      colors.get(uniswapNftPosition.token1.address) || DEFAULT_COLOR1,
      uniswapNftPosition,
      {
        amount0: GN.zero(0),
        amount1: GN.zero(0),
      },
      null
    );
  }, [uniswapNftPosition, poolAddress, slot0, marketData, colors]);

  return (
    <AppPage>
      <div className='mb-4'>
        <Text size='XL'>Import Uniswap Position</Text>
      </div>
      {uniswapCardInfo && tokenId && <BoostCard info={uniswapCardInfo} uniqueId={tokenId} isDisplayOnly={true} />}
    </AppPage>
  );
}
