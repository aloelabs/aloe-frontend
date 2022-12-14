import { ReactElement } from 'react';

import { OutlinedWhiteButtonWithIcon } from 'shared/lib/components/common/Buttons';

export type PortfolioActionButtonProps = {
  label: string;
  Icon: ReactElement;
  onClick: () => void;
};

export default function PortfolioActionButton(props: PortfolioActionButtonProps) {
  const { label, Icon, onClick } = props;
  return (
    <OutlinedWhiteButtonWithIcon
      Icon={Icon}
      fillWidth={true}
      position='leading'
      size='M'
      svgColorType='stroke'
      onClick={onClick}
    >
      {label}
    </OutlinedWhiteButtonWithIcon>
  );
}
