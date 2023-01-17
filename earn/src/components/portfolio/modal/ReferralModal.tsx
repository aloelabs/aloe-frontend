import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber, ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { AltSpinner } from 'shared/lib/components/common/Spinner';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { useAccount, useContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import KittyABI from '../../../assets/abis/Kitty.json';
import { TOPIC0_ENROLL_COURIER_EVENT } from '../../../data/constants/Signatures';
import { LendingPair } from '../../../data/LendingPair';
import { Token } from '../../../data/Token';
import { makeEtherscanRequest } from '../../../util/Etherscan';
import CopyToClipboard from '../../common/CopyToClipboard';
import PairDropdown from '../../common/PairDropdown';
import TokenDropdown from '../../common/TokenDropdown';

const InteractionContainer = styled.div`
  width: 100%;
  height: 64px;
`;

/**
 * Gen
 * @param existingCourierIds an array of existing courier IDs
 * @returns a random 32-bit unsigned integer that is not in existingCourierIds
 */
function generateCourierId(existingCourierIds: number[]): number {
  let courierId: number;
  do {
    courierId = Math.floor(Math.random() * 2 ** 32);
  } while (existingCourierIds.includes(courierId));
  return courierId;
}

export type ReferralModalProps = {
  isOpen: boolean;
  options: LendingPair[];
  defaultOption: LendingPair;
  setIsOpen: (isOpen: boolean) => void;
};

export default function ReferralModal(props: ReferralModalProps) {
  const { isOpen, options, defaultOption, setIsOpen } = props;
  const { activeChain } = useContext(ChainContext);
  const account = useAccount();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLendingPair, setSelectedLendingPair] = useState<LendingPair>(defaultOption);
  const [selectedToken, setSelectedToken] = useState<Token>(defaultOption.kitty0);
  const [courierId, setCourierId] = useState<number | null>(null);
  const [existingCourierIds, setExistingCourierIds] = useState<number[]>([]);
  const [pendingTxn, setPendingTxn] = useState<SendTransactionResult | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setSelectedToken(selectedLendingPair.kitty0);
    setCourierId(null);
  }, [selectedLendingPair]);

  useEffect(() => {
    setIsLoading(true);
    setCourierId(null);
  }, [selectedToken]);

  const {
    write: contractWrite,
    isSuccess: contractDidSucceed,
    isLoading: contractIsLoading,
    data: contractData,
  } = useContractWrite({
    abi: KittyABI,
    address: selectedToken.address,
    functionName: 'enrollCourier',
    mode: 'recklesslyUnprepared',
  });

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
    } else if (!contractIsLoading && !contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractIsLoading, setPendingTxn, setIsOpen]);

  useEffect(() => {
    let mounted = true;
    async function waitForTxn() {
      if (pendingTxn) {
        const receipt = await pendingTxn.wait();
        setPendingTxn(null);
        // If the transaction did not succeed, return
        if (receipt.status !== 1) return;
        const enrollCourierLog = receipt.logs.find(
          (log) => log.address.toLowerCase() === selectedToken.address.toLowerCase()
        );
        const newCourierIdTopic = enrollCourierLog?.topics[1];
        if (newCourierIdTopic) {
          const newCourierId = ethers.utils.defaultAbiCoder.decode(['uint256'], newCourierIdTopic);
          if (mounted) {
            setCourierId(parseInt(newCourierId[0].toString()));
          }
        }
      }
    }
    waitForTxn();
    return () => {
      mounted = false;
    };
  }, [pendingTxn, selectedToken.address]);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const res = await makeEtherscanRequest(
        7537163,
        selectedToken.address,
        [TOPIC0_ENROLL_COURIER_EVENT],
        false,
        activeChain
      );
      const resultData = res.data.result;
      let courierIds = [];
      for (const result of resultData) {
        const courierId = ethers.utils.defaultAbiCoder.decode(['uint256'], result.topics[1]);
        const courierAddress = `0x${result.topics[2].slice(26)}`;
        if (courierAddress.toLowerCase() === account.address?.toLowerCase()) {
          if (mounted) {
            setCourierId(parseInt(courierId.toString()));
            setIsLoading(false);
            return;
          }
        }
        courierIds.push(parseInt(courierId.toString()));
      }
      if (mounted) {
        setExistingCourierIds(courierIds);
        setIsLoading(false);
      }
    }
    if (isOpen) fetch();
    return () => {
      mounted = false;
    };
  }, [isOpen, activeChain, selectedToken.address, account.address]);

  const tokenOptions = useMemo(() => {
    return [selectedLendingPair.kitty0, selectedLendingPair.kitty1];
  }, [selectedLendingPair]);

  const referralLink = useMemo(() => {
    if (courierId != null) {
      return `https://earn.aloe.capital/?ref=${courierId}`;
    }
    return null;
  }, [courierId]);

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Referral' maxWidth='500px'>
      <Text size='M' className='mb-8'>
        Share your referral link to earn a cut of the interest earned by your referrals.
      </Text>
      <div className='w-full flex flex-col gap-8 mb-8'>
        <PairDropdown
          options={options}
          onSelect={(lendingPair: LendingPair) => setSelectedLendingPair(lendingPair)}
          selectedOption={selectedLendingPair}
          size='M'
        />
        <TokenDropdown
          options={tokenOptions}
          onSelect={(token: Token) => setSelectedToken(token)}
          selectedOption={selectedToken}
          size='M'
        />
      </div>
      <InteractionContainer>
        {!isLoading && referralLink == null && pendingTxn == null && (
          <FilledStylizedButton
            size='M'
            fillWidth={true}
            disabled={pendingTxn != null || isPending}
            onClick={() => {
              setIsPending(true);
              const generatedCourierId = generateCourierId(existingCourierIds);
              contractWrite?.({
                recklesslySetUnpreparedArgs: [generatedCourierId, account.address, 5_000],
                recklesslySetUnpreparedOverrides: { gasLimit: BigNumber.from('600000') },
              });
            }}
          >
            Generate Link
          </FilledStylizedButton>
        )}
        {(isLoading || (!isLoading && pendingTxn != null)) && (
          <div className='flex justify-center relative top-1/2'>
            <AltSpinner size='S' />
          </div>
        )}
        {!isLoading && referralLink != null && <CopyToClipboard text={referralLink || ''} />}
      </InteractionContainer>
    </Modal>
  );
}
