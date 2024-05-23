import useLocalStorage from 'shared/lib/hooks/UseLocalStorage';

import PortfolioTooltip from './PortfolioTooltip';

export type PortfolioPageWidgetWrapperProps = {
  children: React.ReactNode;
  tooltip: string;
  tooltipId: string;
};

export default function PortfolioPageWidgetWrapper(props: PortfolioPageWidgetWrapperProps) {
  const { children, tooltip, tooltipId } = props;
  const [isOpen, setIsOpen] = useLocalStorage(tooltipId, true);
  return (
    <div className='w-full relative'>
      {children}
      {tooltip && <PortfolioTooltip content={tooltip} isOpen={isOpen} setIsOpen={setIsOpen} />}
    </div>
  );
}
