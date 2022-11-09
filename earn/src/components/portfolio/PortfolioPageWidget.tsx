import { useState } from 'react';

import useLocalStorage from 'shared/lib/data/hooks/UseLocalStorage';

import LeftFacingIndependentTooltip from './LeftFacingIndendentTooltip';

export type PortfolioPageWidgetWrapperProps = {
  children: React.ReactNode;
  tooltip: string;
  tooltipId: string;
};

export default function PortfolioPageWidgetWrapper(props: PortfolioPageWidgetWrapperProps) {
  const { children, tooltip, tooltipId } = props;
  // const [isOpen, setIsOpen] = useState(true);
  const [isOpen, setIsOpen] = useLocalStorage(tooltipId, true);
  return (
    <div className='w-full relative'>
      {children}
      {tooltip && <LeftFacingIndependentTooltip content={tooltip} isOpen={isOpen} setIsOpen={setIsOpen} />}
    </div>
  );
}
