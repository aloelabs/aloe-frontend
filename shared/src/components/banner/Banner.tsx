import { Text } from '../common/Typography';
import styled from 'styled-components';

import CloseModal from '../../assets/svg/CloseModal';
import useLocalStorage from '../../data/hooks/UseLocalStorage';
import { GREY_700 } from '../../data/constants/Colors';

const BannerWrapper = styled.div`
  position: fixed;
  z-index: 9;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
`;

const BannerContainer = styled.div<{ bgColor: string }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  background-color: ${(props) => props.bgColor};
  border: 1px solid ${GREY_700};
  border-top: 0;
  border-radius: 4px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  padding: 12px;
`;

const Badge = styled.div<{ bgColor: string }>`
  display: flex;
  justify-content: center;
  align-items: center;

  background-color: ${(props) => props.bgColor};
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

type BannerProps = {
  bannerName: string;
  bannerText: string;
  bannerColor: string;
};

const hashCode = (s: string) => s.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);

export default function Banner(props: BannerProps) {
  const { bannerName, bannerText, bannerColor } = props;

  const bannerKey = hashCode(bannerName.concat(bannerText)).toFixed();
  const [isShowing, setIsShowing] = useLocalStorage(bannerKey, true);
  if (!isShowing) return null;
  return (
    <BannerWrapper>
      <BannerContainer bgColor={bannerColor}>
        <div className='flex justify-center items-center'>
          <Badge bgColor='#ffffffcb' className='mix-blend-luminosity'>
            <Text size='S' weight='bold' color='#000000bc' className='mix-blend-darken'>
              {bannerName}
            </Text>
          </Badge>
          <Text size='S' weight='medium'>
            {bannerText}
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
