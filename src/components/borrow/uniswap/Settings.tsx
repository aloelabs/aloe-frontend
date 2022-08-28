import { ChangeEvent, useRef, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { ReactComponent as GearIcon } from '../../../assets/svg/gear.svg';
import useClickOutside from '../../../data/hooks/UseClickOutside';
import { formatNumberInput } from '../../../util/Numbers';
import { SquareInputWithTrailingUnit } from '../../common/Input';
import Tooltip from '../../common/Tooltip';
import { Text } from '../../common/Typography';

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
  z-index: 30;
  background-color: rgba(13, 24, 33, 1);
  border: 1px solid rgba(26, 41, 52, 1);
  border-radius: 8px;
  width: 250px;
  padding: 16px;
  top: 42px;
  right: 0;
`;

//TODO: Improve styling and possibly create a more generic reusable button to replace this
const AutoSlippageButton = styled.button.attrs(
  (props: { active: boolean }) => props
)`
  padding: 4px 8px;
  border-radius: 8px;
  background-color: ${props => props.active ? '#63b59a' : 'transparent'};
  border: 1px solid rgba(26, 41, 52, 1);
`;

//TODO: add error messages for illegal input and warning messages for naive input
export default function Settings() {
  const [localSlippagePercentage, setLocalSlippagePercentage] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const settingsMenuRef = useRef(null);
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
                  setLocalSlippagePercentage('');
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
                setLocalSlippagePercentage(output);
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
