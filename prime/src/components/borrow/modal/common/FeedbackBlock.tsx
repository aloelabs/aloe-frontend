import React from "react";
import { MESSAGE_TEXT_COLOR } from '../../../common/Modal';
import { Text } from 'shared/lib/components/common/Typography';

export default function FeedbackBlock() {
  return (
    <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR}>
        We'd love to hear your feedback! If you have a second, please{' '}
        <a
        href={'https://coda.io/form/Aloe-II-Web-App-Feedback-Form_dtlDhQRDThF'}
        target='_blank'
        className='underline'
        rel='noopener noreferrer'
        title='Share feedback!'
        >share your experience</a>!
      </Text>
  );
}
