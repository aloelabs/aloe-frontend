import { format } from 'date-fns';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

const TOOLTIP_BG_COLOR = 'rgba(0, 0, 0, 0.4)';
const TOOLTIP_BORDER_COLOR = 'rgba(255, 255, 255, 0.1)';
const TOOLTIP_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const TooltipContainer = styled.div`
  ${tw`rounded-md shadow-md`}
  background: ${TOOLTIP_BG_COLOR};
  border: 1px solid ${TOOLTIP_BORDER_COLOR};
`;

const TooltipTitleContainer = styled.div`
  ${tw`flex flex-col justify-center align-middle pt-3 px-3 pb-1`}
  border-bottom: 1px solid ${TOOLTIP_BORDER_COLOR};
`;

export default function InfoGraphTooltip(data: any, active = false) {
  if (!active || data.label === undefined) return null;

  const datetime = new Date(data.label);
  const formattedDate = datetime ? format(datetime, 'MMM dd, yyyy') : '';
  const formattedTime = datetime ? format(datetime, 'hh:mm a') : '';

  const payload = data.payload.concat().sort((a: any, b: any) => b.value - a.value);
  const tooltipValues = payload.map((item: any, index: number) => {
    return (
      <div className='flex justify-between gap-2' key={index}>
        <Text size='S' weight='medium' color={item.color}>
          {item.name}
        </Text>
        <Text size='S' weight='medium' color={item.color}>
          {item.value.toFixed(2)}%
        </Text>
      </div>
    );
  });

  return (
    <TooltipContainer>
      <TooltipTitleContainer>
        <Text size='XS' weight='medium' color={TOOLTIP_TEXT_COLOR}>
          {formattedDate}
        </Text>
        <Text size='XS' weight='medium' color={TOOLTIP_TEXT_COLOR}>
          ~{formattedTime}
        </Text>
      </TooltipTitleContainer>
      <div className='flex flex-col justify-between gap-2 mt-1 px-3 pb-3'>{tooltipValues}</div>
    </TooltipContainer>
  );
}
