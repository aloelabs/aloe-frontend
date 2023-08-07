import { useContext, useEffect, useMemo, useState } from 'react';

import JSBI from 'jsbi';
import { UniswapV3PoolABI } from 'shared/lib/abis/UniswapV3Pool';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { Address, useAccount, useContractReads, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import BoostCard from '../components/boost/BoostCard';
import { BoostCardPlaceholder } from '../components/boost/BoostCardPlaceholder';
import ManageBoostModal from '../components/boost/ManageBoostModal';
import { fetchBoostBorrower, fetchBoostBorrowersList } from '../data/Uniboost';
import {
  UniswapNFTPosition,
  UniswapPosition,
  computePoolAddress,
  fetchUniswapNFTPositions,
  getAmountsForLiquidity,
  getValueOfLiquidity,
} from '../data/Uniswap';
import { getProminentColor } from '../util/Colors';

export enum BoostCardType {
  UNISWAP_NFT,
  BOOST_NFT,
  BOOST_NFT_GENERALIZED,
}

export class BoostCardInfo {
  constructor(
    public readonly cardType: BoostCardType,
    public readonly uniswapPool: Address,
    public readonly currentTick: number,
    public readonly token0: Token,
    public readonly token1: Token,
    public readonly color0: string,
    public readonly color1: string,
    public readonly position: UniswapPosition
  ) {}

  isInRange() {
    return this.position.lower <= this.currentTick && this.currentTick < this.position.upper;
  }

  /**
   * The amount of token0 in the Uniswap Position, not including earned fees
   */
  amount0() {
    return getAmountsForLiquidity(this.position, this.currentTick, this.token0.decimals, this.token1.decimals)[0];
  }

  /**
   * The amount of token1 in the Uniswap Position, not including earned fees
   */
  amount1() {
    return getAmountsForLiquidity(this.position, this.currentTick, this.token0.decimals, this.token1.decimals)[1];
  }

  /**
   * The amount of token0 in the Uniswap Position as a percentage, not including earned fees
   */
  amount0Percent() {
    return 1 - this.amount1Percent();
  }

  /**
   * The amount of token1 in the Uniswap Position as a percentage, not including earned fees
   */
  amount1Percent() {
    const amount1 = this.amount1();
    const totalValueIn1 = getValueOfLiquidity(this.position, this.currentTick, this.token1.decimals);
    return amount1 / totalValueIn1;
  }
}

export default function BoostPage() {
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider({ chainId: activeChain.id });
  const { address: userAddress } = useAccount();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [uniswapNFTPositions, setUniswapNFTPositions] = useState<Map<number, UniswapNFTPosition>>(new Map());
  const [colors, setColors] = useState<Map<number, [string, string]>>(new Map());
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (userAddress === undefined) return;
      const borrowerList = await fetchBoostBorrowersList(activeChain, provider, userAddress);

      const borrowers = await Promise.all(
        borrowerList.map((borrowerAddress) => {
          return fetchBoostBorrower(activeChain.id, provider, borrowerAddress);
        })
      );

      console.log(borrowers);
    })();

    return () => {};
  }, [activeChain, provider, userAddress]);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (userAddress === undefined) return;
      const fetchedUniswapNFTPositions = await fetchUniswapNFTPositions(userAddress, provider, activeChain);
      if (mounted) {
        setUniswapNFTPositions(fetchedUniswapNFTPositions);
        setIsLoading(false);
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

  useEffect(() => {
    const fetch = async () => {
      const entries = Array.from(nonZeroUniswapNFTPositions.entries()).map(async ([idx, pos]) => {
        const color0 = (await getProminentColor(pos.token0.logoURI)).replace(' ', '');
        const color1 = (await getProminentColor(pos.token1.logoURI)).replace(' ', '');
        return [idx, [`rgb(${color0})`, `rgb(${color1})`]] as [number, [string, string]];
      });

      setColors(new Map(await Promise.all(entries)));
    };

    fetch();
    return () => {};
  }, [nonZeroUniswapNFTPositions]);

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

  const uniswapNFTCardInfo: BoostCardInfo[] = useMemo(() => {
    if (slot0Data === undefined || slot0Data.length !== nonZeroUniswapNFTPositions.length) {
      return [];
    }
    return nonZeroUniswapNFTPositions.map((position, index) => {
      const currentTick = slot0Data[index][1];

      return new BoostCardInfo(
        BoostCardType.UNISWAP_NFT,
        computePoolAddress(position),
        currentTick,
        position.token0,
        position.token1,
        colors.get(index)?.[0] ?? 'red',
        colors.get(index)?.[1] ?? 'blue',
        position
      );
    });
  }, [colors, nonZeroUniswapNFTPositions, slot0Data]);

  const selectedPositionInfo = useMemo(() => {
    if (selectedPosition === null) return undefined;
    return uniswapNFTCardInfo[selectedPosition];
  }, [selectedPosition, uniswapNFTCardInfo]);

  return (
    <AppPage>
      <Text size='XL'>Boost</Text>
      <div className='flex flex-wrap gap-4 mt-4'>
        {isLoading &&
          uniswapNFTCardInfo.length === 0 &&
          [...Array(4)].map((_, index) => <BoostCardPlaceholder key={index} />)}
        {uniswapNFTCardInfo.map((info, index) => {
          return (
            <BoostCard key={index} info={info} uniqueId={index.toString()} setSelectedPosition={setSelectedPosition} />
          );
        })}
      </div>
      <ManageBoostModal
        isOpen={selectedPosition !== null}
        uniqueId={selectedPosition?.toString() ?? ''}
        setIsOpen={() => {
          setSelectedPosition(null);
        }}
        uniswapNFTCardInfo={selectedPositionInfo}
      />
    </AppPage>
  );
}
