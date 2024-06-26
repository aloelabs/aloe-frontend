import { useMemo } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import TokenIcon from 'shared/lib/components/common/TokenIcon';
import { Text, Display } from 'shared/lib/components/common/Typography';
import { ALOE_II_BOOST_MANAGER_ADDRESS, ALOE_II_BORROWER_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GREY_700, GREY_800 } from 'shared/lib/data/constants/Colors';
import { GNFormat } from 'shared/lib/data/GoodNumber';
import useChain from 'shared/lib/hooks/UseChain';
import { formatUSD } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { Hex } from 'viem';
import { useSimulateContract, useWriteContract } from 'wagmi';

import { BoostCardInfo } from '../../data/Uniboost';
import { TokenPairQuotes } from '../../pages/boost/ManageBoostPage';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  width: 100%;
  background-color: ${GREY_800};
  border-radius: 8px;
  max-width: 500px;
`;

const FeeAmountsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
  background-color: ${GREY_700};
  border-radius: 8px;
  padding: 12px;
`;

export type CollectFeesWidgetProps = {
  cardInfo: BoostCardInfo;
  tokenQuotes?: TokenPairQuotes;
  setPendingTxn: (txn: WriteContractReturnType | null) => void;
};

export default function CollectFeesWidget(props: CollectFeesWidgetProps) {
  const { cardInfo, tokenQuotes, setPendingTxn } = props;
  const activeChain = useChain();

  const modifyData = useMemo(() => {
    const inner = '0x';
    const actionId = 1;
    return ethers.utils.defaultAbiCoder.encode(['uint8', 'bytes'], [actionId, inner]) as Hex;
  }, []);

  const { data: configBurn } = useSimulateContract({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [cardInfo.owner, [cardInfo.nftTokenPtr!], [ALOE_II_BOOST_MANAGER_ADDRESS[activeChain.id]], [modifyData], [0]],
    chainId: activeChain.id,
    query: {
      enabled:
        cardInfo.nftTokenPtr != null &&
        cardInfo.nftTokenPtr >= 0 &&
        !JSBI.equal(cardInfo?.position.liquidity, JSBI.BigInt(0)),
    },
  });
  const { writeContractAsync: claimFees, isPending: claimFeesIsLoading } = useWriteContract();

  const token0FeesEarnedUSD = tokenQuotes ? cardInfo.feesEarned.amount0.toNumber() * tokenQuotes.token0Price : 0;
  const token1FeesEarnedUSD = tokenQuotes ? cardInfo.feesEarned.amount1.toNumber() * tokenQuotes.token1Price : 0;

  const totalFeesEarnedUSD = token0FeesEarnedUSD + token1FeesEarnedUSD;

  return (
    <Container>
      <div className='flex justify-between items-center gap-8'>
        <Text size='L'>Uncollected Fees</Text>
        <FilledGradientButton
          size='S'
          onClick={() => {
            claimFees(configBurn!.request)
              .then((hash) => setPendingTxn(hash))
              .catch((e) => console.error(e));
          }}
          disabled={claimFeesIsLoading || !configBurn}
        >
          Collect Fees
        </FilledGradientButton>
      </div>
      <div>
        <Display size='M' className='mt-2'>
          {formatUSD(totalFeesEarnedUSD)}
        </Display>
      </div>
      <FeeAmountsContainer>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <TokenIcon token={cardInfo.token0} width={20} height={20} />
            <Text size='L' className='inline-block ml-0.5'>
              {cardInfo.token0.symbol}
            </Text>
          </div>
          <Display size='S'>{cardInfo.feesEarned.amount0.toString(GNFormat.LOSSY_HUMAN)}</Display>
        </div>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <TokenIcon token={cardInfo.token1} width={20} height={20} />
            <Text size='L' className='inline-block ml-0.5'>
              {cardInfo.token1.symbol}
            </Text>
          </div>
          <Display size='S'>{cardInfo.feesEarned.amount1.toString(GNFormat.LOSSY_HUMAN)}</Display>
        </div>
      </FeeAmountsContainer>
    </Container>
  );
}
