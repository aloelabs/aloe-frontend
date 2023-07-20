import { useState } from 'react';

import TokenIcons, { TokenIconsProps } from 'shared/lib/components/common/TokenIcons';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

const TokenIconsWithTooltipWrapper = styled.div`
  display: inline-block;
  position: relative;
  cursor: pointer;
`;

const TooltipWrapper = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  width: max-content;
  max-width: 200px;
  border-radius: 8px;
  background-color: rgba(7, 14, 18, 1);
  border: 1px solid rgba(43, 64, 80, 1);
  z-index: 30;
  pointer-events: none;
`;

export function TokenIconsWithTooltip(props: TokenIconsProps) {
  const { tokens } = props;
  const [isHovering, setIsHovering] = useState(false);
  return (
    <TokenIconsWithTooltipWrapper onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
      <TokenIcons {...props} />
      {isHovering && (
        <TooltipWrapper>
          <Text size='M' weight='medium'>
            {tokens.map((token) => token.symbol).join(', ')}
          </Text>
        </TooltipWrapper>
      )}
    </TokenIconsWithTooltipWrapper>
  );
}
