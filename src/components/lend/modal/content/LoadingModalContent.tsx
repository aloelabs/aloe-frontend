import React from 'react';
import {
  MESSAGE_TEXT_COLOR,
} from '../../../common/Modal';
import { Text } from '../../../common/Typography';
import styled from 'styled-components';
import { AltSpinner, ALT_SPINNER_SIZES } from '../../../common/Spinner';

const SpinnerWrapper = styled.div`
  position: relative;
  width: ${ALT_SPINNER_SIZES.M}px;
  height: ${ALT_SPINNER_SIZES.M}px;
  left: calc(50% - ${ALT_SPINNER_SIZES.M}px / 2);
`;

export default function LoadingModalContent() {
  return (
    <div className='mt-4'>
      <div className='flex justify-between items-center mb-6 max-w-sm'>
        <SpinnerWrapper>
          <AltSpinner size='M' />
        </SpinnerWrapper>
      </div>
      <div className='flex justify-between items-center mb-6 max-w-sm'>
        <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR}>
          This might take a while. Feel free to leave the page and come back later.
        </Text>
      </div>
    </div>
  );
}
