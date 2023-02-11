import { OutlinedWhiteButtonWithIcon } from 'shared/lib/components/common/Buttons';

import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';

export default function ManageAccountButtons() {
  return (
    <div className='flex flex-col gap-2 w-max'>
      <OutlinedWhiteButtonWithIcon
        Icon={<PlusIcon />}
        position='leading'
        onClick={() => {}}
        size='S'
        svgColorType='stroke'
      >
        Add Collateral
      </OutlinedWhiteButtonWithIcon>
      <OutlinedWhiteButtonWithIcon
        Icon={<PlusIcon />}
        position='leading'
        onClick={() => {}}
        size='S'
        svgColorType='stroke'
      >
        Remove Collateral
      </OutlinedWhiteButtonWithIcon>
      <OutlinedWhiteButtonWithIcon
        Icon={<PlusIcon />}
        position='leading'
        onClick={() => {}}
        size='S'
        svgColorType='stroke'
      >
        Borrow
      </OutlinedWhiteButtonWithIcon>
      <OutlinedWhiteButtonWithIcon
        Icon={<PlusIcon />}
        position='leading'
        onClick={() => {}}
        size='S'
        svgColorType='stroke'
      >
        Repay
      </OutlinedWhiteButtonWithIcon>
    </div>
  );
}
