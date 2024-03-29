import { FilledGreyButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import styled from 'styled-components';

import { ReactComponent as CopyIcon } from '../../assets/svg/copy.svg';

const Container = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid ${GREY_700};
  border-radius: 8px;
  padding: 12px 16px;
  white-space: nowrap;
`;

export type CopyToClipboardProps = {
  text: string;
};

export default function CopyToClipboard(props: CopyToClipboardProps) {
  const { text } = props;
  return (
    <Container>
      <Text size='M' className='nowrap'>
        {text.length > 40 ? `${text.slice(0, 40)}...` : text}
      </Text>
      <FilledGreyButtonWithIcon
        Icon={<CopyIcon />}
        position='center'
        size='S'
        svgColorType='stroke'
        onClick={() => {
          navigator.clipboard.writeText(text);
        }}
      />
    </Container>
  );
}
