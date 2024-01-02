import { Text } from '../common/Typography';
import styled from 'styled-components';

import CloseModal from '../../assets/svg/CloseModal';
import useLocalStorage from '../../data/hooks/UseLocalStorage';
import { GREY_700 } from '../../data/constants/Colors';

const LAUNCH_BANNER_KEY = 'launch-banner';
const GREEN_ACCENT = 'rgba(82, 182, 154, 1)';

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
  background-color: ${GREEN_ACCENT};
  border: 1px solid ${GREY_700};
  border-top: 0;
  border-radius: 4px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  padding: 8px;
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

export default function LaunchBanner() {
  const [isShowing, setIsShowing] = useLocalStorage(LAUNCH_BANNER_KEY, true);
  if (!isShowing) return null;
  return (
    <BannerWrapper>
      <BannerContainer>
        <div className='w-full flex justify-center items-center ml-[32px]'>
          <Text size='M' weight='bold'>
            🎉 &nbsp;Aloe II is live!&nbsp; 🎉
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
