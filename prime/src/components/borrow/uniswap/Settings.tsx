import { ChangeEvent, useEffect, useRef, useState } from 'react';

import { SquareInputWithTrailingUnit } from 'shared/lib/components/common/Input';
import { Text } from 'shared/lib/components/common/Typography';
import { formatNumberInput } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import tw from 'twin.macro';

import { ReactComponent as GearIcon } from '../../../assets/svg/gear.svg';
import useClickOutside from '../../../data/hooks/UseClickOutside';
import Tooltip from '../../common/Tooltip';

const SvgButtonWrapper = styled.button`
  ${tw`flex justify-center items-center`}
  height: max-content;
  width: max-content;
  margin-top: auto;
  margin-bottom: auto;
  background-color: transparent;
  border-radius: 8px;
  padding: 6px;
  svg {
    path {
      stroke: #fff;
    }
  }

  &:hover {
    svg {
      path {
        stroke: rgba(255, 255, 255, 0.75);
      }
    }
  }
`;

const SettingsMenuWrapper = styled.div`
  ${tw`absolute flex flex-col gap-4`}
  z-index: 6;
  background-color: rgba(13, 24, 33, 1);
  border: 1px solid rgba(26, 41, 52, 1);
  border-radius: 8px;
  width: 250px;
  padding: 16px;
  top: 42px;
  right: 0;
`;

//TODO: Improve styling and possibly create a more generic reusable button to replace this
const AutoSlippageButton = styled.button.attrs((props: { active: boolean }) => props)`
  padding: 4px 8px;
  border-radius: 8px;
  background-color: ${(props) => (props.active ? '#63b59a' : 'transparent')};
  border: 1px solid rgba(26, 41, 52, 1);
`;

export type SettingsProps = {
  slippagePercentage: string;
  updateSlippagePercentage: (updatedSlippage: string) => void;
};

//TODO: add error messages for illegal input and warning messages for naive input
export default function Settings(props: SettingsProps) {
  const { slippagePercentage, updateSlippagePercentage } = props;
  const [localSlippagePercentage, setLocalSlippagePercentage] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const settingsMenuRef = useRef(null);
  useEffect(() => {
    if (slippagePercentage !== localSlippagePercentage) {
      setLocalSlippagePercentage(slippagePercentage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slippagePercentage]);
  useClickOutside(settingsMenuRef, () => {
    setIsMenuOpen(false);
  });
  return (
    <div className='relative' ref={settingsMenuRef}>
      <SvgButtonWrapper
        onClick={() => {
          setIsMenuOpen(!isMenuOpen);
        }}
      >
        <GearIcon />
      </SvgButtonWrapper>
      {isMenuOpen && (
        <SettingsMenuWrapper>
          <Tooltip
            buttonSize='S'
            content={<Text size='XS'>a</Text>}
            position='top-right'
            buttonText='Slippage Tolerance'
            filled={true}
          />
          <div className='flex gap-2'>
            <AutoSlippageButton
              type='button'
              active={localSlippagePercentage === ''}
              onClick={() => {
                if (localSlippagePercentage !== '') {
                  updateSlippagePercentage('');
                }
              }}
            >
              <Text size='S' weight='medium'>
                Auto
              </Text>
            </AutoSlippageButton>
            <SquareInputWithTrailingUnit
              value={localSlippagePercentage}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const output = formatNumberInput(e.currentTarget.value);
                if (output != null) {
                  setLocalSlippagePercentage(output);
                }
              }}
              onBlur={() => {
                const currentValue = parseFloat(localSlippagePercentage);
                const output = isNaN(currentValue) ? '' : currentValue.toFixed(2);
                if (slippagePercentage !== output) {
                  updateSlippagePercentage(output);
                } else {
                  setLocalSlippagePercentage(output);
                }
              }}
              inputClassName={localSlippagePercentage !== '' ? 'active' : ''}
              placeholder='0.50'
              size='S'
              fullWidth={true}
              unit='%'
            />
          </div>
        </SettingsMenuWrapper>
      )}
    </div>
  );
}
