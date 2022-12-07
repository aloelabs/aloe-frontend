import React, { useMemo, useRef, useLayoutEffect } from 'react';

import jazzicon from '@metamask/jazzicon';
import styled from 'styled-components';
import { useAccount } from 'wagmi';

const StyledIdenticon = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
`;

export default function Identicon() {
  const account = useAccount();
  const icon = useMemo(() => {
    return account?.address && jazzicon(24, parseInt(account.address.slice(2, 10), 16));
  }, [account?.address]);
  const iconRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const current = iconRef.current;
    if (icon) {
      current?.appendChild(icon);
      return () => {
        try {
          current?.removeChild(icon);
        } catch (e) {
          console.error(e);
        }
      };
    }
    return;
  }, [icon, iconRef]);

  return (
    <StyledIdenticon>
      <span ref={iconRef} />
    </StyledIdenticon>
  );
}
