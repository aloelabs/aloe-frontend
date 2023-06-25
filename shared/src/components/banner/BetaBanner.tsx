import { Text } from '../common/Typography';
import styled from 'styled-components';

import CloseModal from '../../assets/svg/CloseModal';
import useLocalStorage from '../../data/hooks/UseLocalStorage';
import { GREY_700 } from '../../data/constants/Colors';

const BETA_BANNER_KEY = 'beta-banner';

const BannerWrapper = styled.div`
  position: fixed;
  z-index: 9;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
`;

const BannerContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  background-color: #0d171e;
  border: 1px solid ${GREY_700};
  border-top: 0;
  border-radius: 4px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  padding: 12px;
`;

const BetaBadge = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  background-color: #f2c94c1a;
  border-radius: 4px;
  padding: 4px 8px;
  margin-right: 12px;
`;

const CloseButton = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: transparent;
  border: none;
  cursor: pointer;
  margin-left: 12px;
`;

export default function BetaBanner() {
  const [isShowing, setIsShowing] = useLocalStorage(BETA_BANNER_KEY, true);
  if (!isShowing) return null;
  return (
    <BannerWrapper>
      <BannerContainer>
        <div className='flex justify-center items-center'>
          <BetaBadge>
            <Text size='S' weight='bold' color='#F2C94C'>
              BETA
            </Text>
          </BetaBadge>
          <Text size='S' weight='medium'>
            Aloe II is currently in beta. Please use at your own risk.
          </Text>
        </div>
        <div className='flex justify-center items-center'>
          <CloseButton onClick={() => setIsShowing(false)}>
            <CloseModal width={20} height={20} />
          </CloseButton>
        </div>
      </BannerContainer>
    </BannerWrapper>
  );
}
