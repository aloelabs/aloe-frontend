import { useContext, useEffect, useMemo } from 'react';

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
import { formatUSD } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../App';
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
  setPendingTxn: (txn: SendTransactionResult | null) => void;
};

export default function CollectFeesWidget(props: CollectFeesWidgetProps) {
  const { cardInfo, tokenQuotes, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);

  const modifyData = useMemo(() => {
    const inner = '0x';
    const actionId = 1;
    return ethers.utils.defaultAbiCoder.encode(['uint8', 'bytes'], [actionId, inner]) as `0x${string}`;
  }, []);

  const { config: configBurn } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [cardInfo.owner, [cardInfo.nftTokenPtr!], [ALOE_II_BOOST_MANAGER_ADDRESS[activeChain.id]], [modifyData], [0]],
    chainId: activeChain.id,
    enabled:
      cardInfo.nftTokenPtr != null &&
      cardInfo.nftTokenPtr >= 0 &&
      !JSBI.equal(cardInfo?.position.liquidity, JSBI.BigInt(0)),
  });
  let gasLimit = configBurn.request?.gasLimit.mul(110).div(100);
  const {
    write: claimFees,
    data: claimFeesTxn,
    isLoading: claimFeesIsLoading,
    isSuccess: claimFeesDidSucceed,
  } = useContractWrite({
    ...configBurn,
    request: {
      ...configBurn.request,
      gasLimit,
    },
  });

  useEffect(() => {
    if (claimFeesDidSucceed && claimFeesTxn) {
      setPendingTxn(claimFeesTxn);
    }
  }, [claimFeesDidSucceed, claimFeesTxn, claimFeesIsLoading, setPendingTxn]);

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
            claimFees?.();
          }}
          disabled={claimFeesIsLoading}
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
