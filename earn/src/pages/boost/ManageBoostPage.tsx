import { useContext, useEffect } from 'react';

import { ethers } from 'ethers';
import { useParams } from 'react-router-dom';
import { boostNftAbi } from 'shared/lib/abis/BoostNFT';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BOOST_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { Address, useContractRead, useProvider } from 'wagmi';

import { ChainContext } from '../../App';
import BoostCard from '../../components/boost/BoostCard';
import { sqrtRatioToTick } from '../../data/BalanceSheet';
import { BoostCardInfo, BoostCardType, fetchBoostBorrower } from '../../data/Uniboost';

const DEFAULT_COLOR0 = 'white';
const DEFAULT_COLOR1 = 'white';

export default function ManageBoostPage() {
  const { activeChain } = useContext(ChainContext);
  const { nftTokenId } = useParams();
  const provider = useProvider({ chainId: activeChain.id });
  const [cardInfo, setCardInfo] = useChainDependentState<BoostCardInfo | null>(null, activeChain.id);

  const { data: boostNftAttributes } = useContractRead({
    abi: boostNftAbi,
    address: ALOE_II_BOOST_NFT_ADDRESS[activeChain.id],
    functionName: 'attributesOf',
    args: [ethers.BigNumber.from(nftTokenId || 0)],
    enabled: nftTokenId !== undefined,
  });

  const borrowerAddress = boostNftAttributes?.borrower;

  useEffect(() => {
    let mounted = true;
    if (!borrowerAddress || !nftTokenId) return;
    (async () => {
      const res = await fetchBoostBorrower(activeChain.id, provider, borrowerAddress as Address);
      const boostCardInfo = new BoostCardInfo(
        BoostCardType.BOOST_NFT,
        nftTokenId,
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
      if (mounted) {
        setCardInfo(boostCardInfo);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeChain.id, borrowerAddress, nftTokenId, provider, setCardInfo]);

  const isLoading = !cardInfo || !nftTokenId;
  return (
    <AppPage>
      <div className='mb-4'>
        <Text size='XL'>Manage Boost</Text>
      </div>
      {!isLoading && <BoostCard info={cardInfo} uniqueId={nftTokenId} isDisplayOnly={true} />}
    </AppPage>
  );
}
