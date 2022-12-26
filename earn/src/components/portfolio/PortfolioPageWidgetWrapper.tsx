import { useState } from 'react';

import PortfolioTooltip from './PortfolioTooltip';

export type PortfolioPageWidgetWrapperProps = {
  children: React.ReactNode;
  tooltip?: string;
};

export default function PortfolioPageWidgetWrapper(props: PortfolioPageWidgetWrapperProps) {
  const { children, tooltip } = props;
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className='w-full relative'>
      {children}
      {tooltip && <PortfolioTooltip content={tooltip} isOpen={isOpen} setIsOpen={setIsOpen} />}
    </div>
  );
}
