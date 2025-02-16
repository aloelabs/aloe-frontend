import { Fragment, useEffect, useState } from 'react';

import { Tab } from '@headlessui/react';
import Tooltip from 'shared/lib/components/common/Tooltip';
import { Text } from 'shared/lib/components/common/Typography';
import { RESPONSIVE_BREAKPOINT_XS } from 'shared/lib/data/constants/Breakpoints';
import { GREY_400 } from 'shared/lib/data/constants/Colors';
import { formatNumberInput } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

const SLIPPAGE_TOOLTIP_TEXT = `Slippage tolerance is the maximum price difference you are willing to
 accept between the estimated price and the execution price.`;

const PREDEFINED_MAX_SLIPPAGE_OPTIONS = [
  { label: 'Low (0.1%)', value: '0.10' },
  { label: 'Mid (0.5%)', value: '0.50' },
];

const DEFAULT_CUSTOM_SLIPPAGE_PERCENTAGE = '0.10';
const MAX_SLIPPAGE_PERCENTAGE = 100;

const SlippageTabsWrapper = styled.div`
  width: 100%;
  display: flex;
  border: 1px solid rgba(26, 41, 52, 1);
  padding: 4px;
  border-radius: 8px;
`;

const SlippageButton = styled.button`
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 12px;
  height: 35px;
  color: ${GREY_400};
  background-color: rgba(13, 23, 30, 1);
  flex: 1;
  border-radius: 8px;
  overflow: hidden;

  & span {
    font-family: 'Satoshi-Variable';
    font-size: 14px;
    font-weight: 700;
    line-height: 19px;
  }

  &.selected {
    background-color: rgba(26, 41, 52, 1);
    & span {
      background: linear-gradient(90deg, #9baaf3 0%, #7bd8c0 100%);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    padding: 4px 6px;
  }
`;

const CustomSlippageInputWrapper = styled.div`
  width: 100%;
  display: flex;
  position: relative;
  flex: 1;
  padding: 0px 12px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    padding: 0px 6px;
  }
`;

const CustomSlippageInput = styled.input`
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  background-color: rgba(13, 23, 30, 1);
  flex: 1;
  font-family: 'Satoshi-Variable';
  font-size: 14px;
  font-weight: 700;
  line-height: 19px;
  border-radius: 8px;
  padding: 0px 24px 0px 12px;
  caret-color: rgba(82, 182, 154, 1);

  &:focus {
    outline: none;
  }

  &.selected {
    color: rgba(204, 223, 237, 1);
    text-align: left;
    background-color: rgba(26, 41, 52, 1);
  }

  &:disabled {
    opacity: 0.5;
  }

  &::placeholder {
    color: ${GREY_400};
  }
`;

const CustomSlippagePercent = styled.span`
  position: absolute;
  right: 12px;
  top: calc(50% - 9.5px);
  font-family: 'Satoshi-Variable';
  font-size: 14px;
  font-weight: 700;
  line-height: 19px;
  background: linear-gradient(90deg, #9baaf3 0%, #7bd8c0 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

export type MaxSlippageInputProps = {
  updateMaxSlippage: (value: string) => void;
  disabled?: boolean;
};

export default function MaxSlippageInput(props: MaxSlippageInputProps) {
  const { updateMaxSlippage, disabled } = props;
  const [tempSlippagePercentage, setTempSlippage] = useState('0.10');
  const [slippagePercentage, setSlippage] = useState('0.10');

  useEffect(() => {
    if (slippagePercentage !== tempSlippagePercentage) {
      setTempSlippage(slippagePercentage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slippagePercentage]);

  return (
    <div className='w-full flex flex-col gap-y-2'>
      <Text size='S' weight='medium' color='rgba(130, 160, 182, 1)' className='flex gap-x-2 mb-1'>
        <Tooltip
          content={SLIPPAGE_TOOLTIP_TEXT}
          buttonText='Max Slippage'
          buttonSize='S'
          position='bottom-left'
          filled={true}
        />
      </Text>
      <Tab.Group>
        <Tab.List>
          <SlippageTabsWrapper>
            {PREDEFINED_MAX_SLIPPAGE_OPTIONS.map(({ label, value }) => (
              <Tab as={Fragment} key={value}>
                {({ selected }) => (
                  <SlippageButton
                    className={selected ? 'selected' : ''}
                    onClick={() => updateMaxSlippage(value)}
                    disabled={disabled}
                  >
                    <span>{label}</span>
                  </SlippageButton>
                )}
              </Tab>
            ))}
            <Tab as={Fragment} key='Custom'>
              {({ selected }) => {
                if (selected) {
                  return (
                    <>
                      <CustomSlippageInputWrapper>
                        <CustomSlippageInput
                          onChange={(e) => {
                            const output = formatNumberInput(e.currentTarget.value);
                            if (output != null) {
                              setTempSlippage(output);
                            }
                          }}
                          onBlur={() => {
                            let currentValue = parseFloat(tempSlippagePercentage);
                            currentValue =
                              currentValue > MAX_SLIPPAGE_PERCENTAGE ? MAX_SLIPPAGE_PERCENTAGE : currentValue;
                            const output = isNaN(currentValue)
                              ? DEFAULT_CUSTOM_SLIPPAGE_PERCENTAGE
                              : currentValue.toFixed(2);
                            if (slippagePercentage !== output) {
                              setSlippage(output);
                              updateMaxSlippage(output);
                            } else {
                              setTempSlippage(output);
                            }
                          }}
                          type='text'
                          className={selected ? 'selected' : ''}
                          autoFocus={true}
                          value={tempSlippagePercentage}
                          placeholder='0'
                          disabled={disabled}
                        />
                        <CustomSlippagePercent>%</CustomSlippagePercent>
                      </CustomSlippageInputWrapper>
                    </>
                  );
                } else {
                  return (
                    <SlippageButton onClick={() => updateMaxSlippage(slippagePercentage)} disabled={disabled}>
                      <span>Custom</span>
                    </SlippageButton>
                  );
                }
              }}
            </Tab>
          </SlippageTabsWrapper>
        </Tab.List>
      </Tab.Group>
    </div>
  );
}
