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
    <OutlinedWhiteButtonWithIcon Icon={Icon} position='leading' size='L' svgColorType='stroke' onClick={onClick}>
      {label}
    </OutlinedWhiteButtonWithIcon>
  );
}
