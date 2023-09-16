import { OutlinedWhiteButtonWithIcon } from 'shared/lib/components/common/Buttons';

import { ReactComponent as CreditCardIcon } from '../../assets/svg/credit_card.svg';
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
  onGetLeverage: () => void;
  onWithdrawAnte: () => void;
  isWithdrawAnteDisabled: boolean;
};

export default function ManageAccountButtons(props: ManageAccountButtonsProps) {
  const {
    onAddCollateral,
    onRemoveCollateral,
    onBorrow,
    onRepay,
    onGetLeverage,
    onWithdrawAnte,
    isWithdrawAnteDisabled,
  } = props;
  return (
    <div className='flex flex-col gap-3 w-max'>
      <OutlinedWhiteButtonWithIcon
        Icon={<PlusIcon />}
        position='leading'
        onClick={onAddCollateral}
        size='S'
        svgColorType='stroke'
      >
        Add Collateral
      </OutlinedWhiteButtonWithIcon>
      <OutlinedWhiteButtonWithIcon
        Icon={<MinusIcon />}
        position='leading'
        onClick={onRemoveCollateral}
        size='S'
        svgColorType='stroke'
      >
        Remove Collateral
      </OutlinedWhiteButtonWithIcon>
      <OutlinedWhiteButtonWithIcon
        Icon={<PercentIcon />}
        position='leading'
        onClick={onBorrow}
        size='S'
        svgColorType='stroke'
      >
        Borrow
      </OutlinedWhiteButtonWithIcon>
      <OutlinedWhiteButtonWithIcon
        Icon={<ZapIcon />}
        position='leading'
        onClick={onRepay}
        size='S'
        svgColorType='stroke'
      >
        Repay
      </OutlinedWhiteButtonWithIcon>
      <OutlinedWhiteButtonWithIcon
        Icon={<CreditCardIcon />}
        position='leading'
        onClick={onGetLeverage}
        size='S'
        svgColorType='stroke'
      >
        Get Leverage
      </OutlinedWhiteButtonWithIcon>
      <OutlinedWhiteButtonWithIcon
        Icon={<FrownIcon />}
        position='leading'
        onClick={onWithdrawAnte}
        size='S'
        svgColorType='stroke'
        disabled={isWithdrawAnteDisabled}
      >
        Withdraw Ante
      </OutlinedWhiteButtonWithIcon>
    </div>
  );
}
