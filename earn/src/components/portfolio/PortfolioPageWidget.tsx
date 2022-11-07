import { useState } from 'react';

import LeftFacingIndependentTooltip from './LeftFacingIndendentTooltip';

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
      {tooltip && <LeftFacingIndependentTooltip content={tooltip} isOpen={isOpen} setIsOpen={setIsOpen} />}
    </div>
  );
}
