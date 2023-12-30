import Logo from 'shared/lib/assets/svg/AloeCapitalLogo';
import { Display } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

const StyledAppPage = styled.div`
  width: 100%;
  height: calc(100vh - 128px);
  display: flex;
  justify-content: center;
  align-items: center;
`;

export default function ComingSoonPage() {
  return (
    <StyledAppPage>
      <div className='flex flex-col items-center justify-center'>
        <Logo />
        <Display size='XL'>Coming Soon</Display>
      </div>
    </StyledAppPage>
  );
}
