import { OutlinedWhiteButtonWithIcon } from 'shared/lib/components/common/Buttons';

import { ReactComponent as FrownIcon } from '../../assets/svg/frown.svg';
import { ReactComponent as MinusIcon } from '../../assets/svg/minus.svg';
import { ReactComponent as PercentIcon } from '../../assets/svg/percent.svg';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';
import { ReactComponent as ZapIcon } from '../../assets/svg/zap.svg';

export type ManageAccountButtonsProps = {
  onAddCollateral: () => void;
  onRemoveCollateral: () => void;
  onBorrow: () => void;
  onRepay: () => void;
  onWithdrawAnte?: () => void;
  onClearWarning?: () => void;
  isDisabled: boolean;
};

export default function ManageAccountButtons(props: ManageAccountButtonsProps) {
  const { onAddCollateral, onRemoveCollateral, onBorrow, onRepay, onWithdrawAnte, onClearWarning, isDisabled } = props;
  return (
    <div className='flex flex-row flex-wrap justify-start gap-3 w-full'>
      <OutlinedWhiteButtonWithIcon
        Icon={<PlusIcon />}
        position='leading'
        onClick={onAddCollateral}
        size='S'
        svgColorType='stroke'
        disabled={isDisabled}
      >
        Add Collateral
      </OutlinedWhiteButtonWithIcon>
      <OutlinedWhiteButtonWithIcon
        Icon={<MinusIcon />}
        position='leading'
        onClick={onRemoveCollateral}
        size='S'
        svgColorType='stroke'
        disabled={isDisabled}
      >
        Remove Collateral
      </OutlinedWhiteButtonWithIcon>
      <OutlinedWhiteButtonWithIcon
        Icon={<PercentIcon />}
        position='leading'
        onClick={onBorrow}
        size='S'
        svgColorType='stroke'
        disabled={isDisabled}
      >
        Borrow
      </OutlinedWhiteButtonWithIcon>
      <OutlinedWhiteButtonWithIcon
        Icon={<ZapIcon />}
        position='leading'
        onClick={onRepay}
        size='S'
        svgColorType='stroke'
        disabled={isDisabled}
      >
        Repay
      </OutlinedWhiteButtonWithIcon>
      {onWithdrawAnte && (
        <OutlinedWhiteButtonWithIcon
          Icon={<FrownIcon />}
          position='leading'
          onClick={onWithdrawAnte}
          size='S'
          svgColorType='stroke'
          disabled={isDisabled}
        >
          Withdraw Ante
        </OutlinedWhiteButtonWithIcon>
      )}
      {onClearWarning && (
        <OutlinedWhiteButtonWithIcon
          Icon={<FrownIcon />}
          position='leading'
          onClick={onClearWarning}
          size='S'
          svgColorType='stroke'
          disabled={isDisabled}
        >
          End Auction
        </OutlinedWhiteButtonWithIcon>
      )}
    </div>
  );
}
