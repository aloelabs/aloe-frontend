import { useEffect, useState } from 'react';

import axios, { AxiosResponse } from 'axios';
import { useNavigate } from 'react-router-dom';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGradientButton, FilledGreyButton } from 'shared/lib/components/common/Buttons';
import { SquareInput } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { useAccount } from 'wagmi';

import { ReactComponent as ErrorIcon } from '../assets/svg/error.svg';
import { ReactComponent as SuccessIcon } from '../assets/svg/success.svg';
import { API_REDEEM_REWARD_URL } from '../data/constants/Values';
import { RedeemRewardResponse } from '../data/RedeemRewardReponse';

const validAddressFormRegex = /^0x[0-9a-fA-F]{40}$/;
const validCodeFormRegex = /^[0-9]{6}$/;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 64px;
  max-width: 1280px;
  height: calc(100vh - 256px);
  margin: 0 auto;
`;

const InnerContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin: 0 auto;
`;

async function claimReward(redemptionCode: string, redemptionAddress: string) {
  const axiosResponse: AxiosResponse<RedeemRewardResponse> = await axios.post(
    `${API_REDEEM_REWARD_URL}/${redemptionCode}`,
    { redemptionAddress },
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  );
  const { data } = axiosResponse;
  if (axiosResponse.status !== 200) {
    return Promise.reject(data.message);
  }
  return Promise.resolve(data);
}

type SuccessModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

function SuccessModal(props: SuccessModalProps) {
  const { isOpen, setIsOpen } = props;

  const navigate = useNavigate();

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen}>
      <div className='w-full flex flex-col items-center gap-4'>
        <SuccessIcon width={75} height={75} />
        <Display size='XL' weight='semibold'>
          10 USDC+
        </Display>
        <Text size='L' weight='bold'>
          has been sent to your wallet.
        </Text>
        <FilledGradientButton size='M' onClick={() => navigate('/portfolio')}>
          Go To Portfolio
        </FilledGradientButton>
      </div>
    </Modal>
  );
}

type ErrorModalProps = {
  message: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

function ErrorModal(props: ErrorModalProps) {
  const { message, isOpen, setIsOpen } = props;

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen}>
      <div className='w-full flex flex-col items-center gap-4'>
        <ErrorIcon width={75} height={75} />
        <Text size='L' weight='bold' className='text-center'>
          {message}
        </Text>
        <FilledGreyButton size='M' onClick={() => setIsOpen(false)}>
          Close
        </FilledGreyButton>
      </div>
    </Modal>
  );
}

export default function ClaimPage() {
  const [redemptionCode, setRedemptionCode] = useState<string>('');
  const [redemptionAddress, setRedemptionAddress] = useState<string>('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState<boolean>(false);
  const [modalMessage, setModalMessage] = useState<string>('');

  const { address: userAddress } = useAccount();

  useEffect(() => {
    if (userAddress) {
      setRedemptionAddress(userAddress);
    }
  }, [userAddress]);

  return (
    <AppPage>
      <Container>
        <InnerContainer>
          <div className='w-full flex flex-col items-center'>
            <Text size='L' weight='bold'>
              Claim your
            </Text>
            <Display size='XL' weight='semibold'>
              10 USDC+
            </Display>
          </div>
          <SquareInput
            size='L'
            value={redemptionCode}
            onChange={(e) => setRedemptionCode(e.target.value)}
            placeholder='Redemption Code'
            paddingRightOverride='24px'
          />
          <SquareInput
            size='L'
            value={redemptionAddress}
            onChange={(e) => setRedemptionAddress(e.target.value)}
            placeholder='Recipient'
            paddingRightOverride='24px'
          />
          <FilledGradientButton
            size='M'
            onClick={() => {
              setModalMessage('');
              if (!validAddressFormRegex.test(redemptionAddress)) {
                setModalMessage('Please enter a valid Ethereum address.');
                setIsErrorModalOpen(true);
                return;
              }
              if (!validCodeFormRegex.test(redemptionCode)) {
                setModalMessage('Please enter a valid redemption code.');
                setIsErrorModalOpen(true);
                return;
              }
              claimReward(redemptionCode, redemptionAddress)
                .then((data) => {
                  setModalMessage(data.message);
                  if (data.success) {
                    setIsSuccessModalOpen(true);
                  } else {
                    setIsErrorModalOpen(true);
                  }
                })
                .catch((_error) => {
                  setModalMessage('Something went wrong. Please try again later.');
                  setIsErrorModalOpen(true);
                });
            }}
          >
            Claim
          </FilledGradientButton>
        </InnerContainer>
      </Container>
      <SuccessModal isOpen={isSuccessModalOpen} setIsOpen={setIsSuccessModalOpen} />
      <ErrorModal message={modalMessage} isOpen={isErrorModalOpen} setIsOpen={setIsErrorModalOpen} />
    </AppPage>
  );
}
