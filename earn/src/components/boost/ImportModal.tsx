import { useContext, useMemo, useState } from 'react';

import { ethers } from 'ethers';
import { boostNftAbi } from 'shared/lib/abis/BoostNFT';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { ANTES } from 'shared/lib/data/constants/ChainSpecific';
import styled from 'styled-components';
import { erc721ABI, useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';

import { ChainContext } from '../../App';
import { UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from '../../data/constants/Addresses';
import { BOOST_NFT_ADDRESSES, BoostCardInfo } from '../../data/Uniboost';
import BoostCard from './BoostCard';

const Container = styled.div`
  display: flex;
  justify-content: space-between;
`;

const ImportContainer = styled.div`
  width: 300px;
  text-align: center;
`;

const StyledDatalist = styled.datalist`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 200px;
`;

const LeverageSlider = styled.input`
  -webkit-appearance: none;
  height: 4px;
  background: grey;
  border-radius: 0px;
  background-image: linear-gradient(#d46a6a, #d46a6a);
  background-repeat: no-repeat;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    margin-top: -16px;
    height: 16px;
    width: 8px;
    border-radius: 0px;
    background: #ffffff;
    cursor: pointer;
  }

  &::-webkit-slider-runnable-track {
    -webkit-appearance: none;
    width: 100%;
    box-shadow: none;
    border: none;
    background: transparent;
  }
`;

// TODO: dynamic for chain; move to shared
const ALOE_II_BOOST_MANAGER_ADDRESS = '0xD13C5D053387Ca59BAf0aBC0B18Af1C1d3413Ed5';
const BOOST_MIN = 1;
const BOOST_MAX = 5;

enum ImportModalState {
  FETCHING_DATA,
  READY_TO_APPROVE,
  ASKING_USER_TO_APPROVE,
  WAITING_FOR_TRANSACTION,
  READY_TO_MINT,
  ASKING_USER_TO_MINT,
}

export type ImportModalProps = {
  cardInfo?: BoostCardInfo;
  uniqueId: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export default function ImportModal(props: ImportModalProps) {
  const { cardInfo, uniqueId, isOpen, setIsOpen } = props;
  const { activeChain } = useContext(ChainContext);

  const [boostFactor, setBoostFactor] = useState(1);

  const nftTokenId = ethers.BigNumber.from(cardInfo?.nftTokenId || 0);
  const initializationData = useMemo(() => {
    if (!cardInfo) return undefined;
    const { position } = cardInfo;
    return ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'int24', 'int24', 'uint128', 'uint8'],
      [cardInfo.nftTokenId, position.lower, position.upper, position.liquidity.toString(10), boostFactor]
    ) as `0x${string}`;
  }, [cardInfo, boostFactor]);
  const enableHooks = isOpen && cardInfo !== undefined;

  // Read who is approved to manage this Uniswap NFT
  const {
    data: manager,
    refetch: refetchManager,
    isFetching: isFetchingManager,
  } = useContractRead({
    address: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
    abi: erc721ABI,
    functionName: 'getApproved',
    args: [nftTokenId],
    chainId: activeChain.id,
    enabled: enableHooks,
  });
  const shouldWriteManager = !isFetchingManager && !!manager && manager !== ALOE_II_BOOST_MANAGER_ADDRESS;
  const shouldMint = !isFetchingManager && !!initializationData && manager === ALOE_II_BOOST_MANAGER_ADDRESS;

  // We need the Boost Manager to be approved, so if it's not, prepare to write
  const { config: configWriteManager } = usePrepareContractWrite({
    address: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
    abi: erc721ABI,
    functionName: 'approve',
    // TODO: Boost manager addresses across chains
    args: [ALOE_II_BOOST_MANAGER_ADDRESS, nftTokenId],
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
    onSuccess(data) {
      console.debug('Approve transaction successful!', data);
      refetchManager();
    },
  });

  // Prepare for actual import/mint transaction
  const { config: configMint } = usePrepareContractWrite({
    address: BOOST_NFT_ADDRESSES[activeChain.id],
    abi: boostNftAbi,
    functionName: 'mint',
    args: [cardInfo?.uniswapPool ?? '0x', initializationData ?? '0x'],
    overrides: { value: ANTES[activeChain.id].recklessAdd(1).toBigNumber() },
    chainId: activeChain.id,
    enabled: enableHooks && shouldMint,
  });
  gasLimit = configMint.request?.gasLimit.mul(110).div(100);
  const {
    write: mint,
    data: mintTxn,
    isLoading: isAskingUserToMint,
  } = useContractWrite({
    ...configMint,
    request: {
      ...configMint.request,
      gasLimit,
    },
  });

  // Wait for the mint transaction to go through
  const { isLoading: isMinting } = useWaitForTransaction({
    confirmations: 1,
    hash: mintTxn?.hash,
    chainId: activeChain.id,
    onSuccess(data) {
      // TODO: prob want to reload the page in here. keep the console.debug if possible (for consistency since we have this style of thing elsewhere)
      console.debug('Mint transaction successful!', data);
    },
  });

  // TODO: you can remove these console.logs obviously
  let state: ImportModalState;
  if (isFetchingManager) {
    state = ImportModalState.FETCHING_DATA;
    console.log('fetching');
  } else if (isWritingManager || isMinting) {
    state = ImportModalState.WAITING_FOR_TRANSACTION;
    console.log('waiting for txn');
  } else if (isAskingUserToWriteManager) {
    state = ImportModalState.ASKING_USER_TO_APPROVE;
    console.log('asking user to approve');
  } else if (isAskingUserToMint) {
    state = ImportModalState.ASKING_USER_TO_MINT;
    console.log('asking user to mint');
  } else if (shouldWriteManager && writeManager) {
    state = ImportModalState.READY_TO_APPROVE;
    console.log('ready to approve');
  } else if (shouldMint && mint) {
    state = ImportModalState.READY_TO_MINT;
    console.log('ready to mint');
  }

  // Generate labels for input range (slider)
  const labels: string[] = [];
  for (let i = BOOST_MIN; i <= BOOST_MAX; i += 1) {
    labels.push(`${i.toFixed(0)}x`);
  }

  return (
    <Modal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title={'Manage'}
      maxWidth='640px'
      backgroundColor='rgba(43, 64, 80, 0.1)'
      backdropFilter='blur(40px)'
    >
      {cardInfo && (
        <Container>
          <BoostCard info={cardInfo} isDisplayOnly={true} uniqueId={uniqueId} />
          <ImportContainer>
            <LeverageSlider
              type='range'
              list='boost-factor-labels'
              min={BOOST_MIN}
              max={BOOST_MAX}
              step={1}
              value={boostFactor}
              onChange={(e) => setBoostFactor(parseInt(e.target.value) || 0)}
            />
            <StyledDatalist id='boost-factor-labels'>
              {labels.map((label, i) => (
                <option key={i} value={i + 1} label={label}></option>
              ))}
            </StyledDatalist>
            <Text size='M' weight='bold'>
              Import thingy
            </Text>
            <Text size='S'>Coming soon</Text>
            <button className='bg-white' onClick={writeManager}>
              Approve
            </button>
            <button className='bg-white' onClick={mint}>
              Mint
            </button>
          </ImportContainer>
        </Container>
      )}
    </Modal>
  );
}
