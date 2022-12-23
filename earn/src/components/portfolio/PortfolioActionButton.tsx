import { ReactElement } from 'react';

import { OutlinedWhiteButtonWithIcon } from 'shared/lib/components/common/Buttons';

export type PortfolioActionButtonProps = {
  label: string;
  Icon: ReactElement;
  disabled?: boolean;
  onClick: () => void;
};

export default function PortfolioActionButton(props: PortfolioActionButtonProps) {
  const { label, Icon, disabled, onClick } = props;
  return (
    <OutlinedWhiteButtonWithIcon
      Icon={Icon}
      fillWidth={true}
      position='leading'
      size='M'
      svgColorType='stroke'
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </OutlinedWhiteButtonWithIcon>
  );
}
