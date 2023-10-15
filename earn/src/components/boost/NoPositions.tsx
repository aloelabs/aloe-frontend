import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { ReactComponent as InboxIcon } from '../../assets/svg/inbox.svg';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

const StyledInboxIcon = styled(InboxIcon)`
  path {
    stroke: #ffffff;
  }
`;

const TextContainer = styled.div`
  width: 100%;
  max-width: 400px;
  text-align: center;
`;

export type NoPositionsProps = {
  primaryText?: string;
  secondaryText?: string;
};

export default function NoPositions(props: NoPositionsProps) {
  const { primaryText, secondaryText } = props;
  return (
    <div className='w-full flex flex-col items-center justify-center gap-2'>
      <StyledInboxIcon />
      <TextContainer>
        <Text size='M'>{primaryText}</Text>
        <Text size='XS' color={SECONDARY_COLOR}>
          {secondaryText}
        </Text>
      </TextContainer>
    </div>
  );
}
