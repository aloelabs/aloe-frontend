import { useEffect, useMemo, useState } from 'react';

import { FilledGreyButton } from 'shared/lib/components/common/Buttons';
import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import { Text } from 'shared/lib/components/common/Typography';

import { LendingPair } from '../../../data/LendingPair';
import { getReferenceAddress, GetTokenData, TokenData } from '../../../data/TokenData';
import { formatNumberInput } from '../../../util/Numbers';
import CustomModal from '../../common/CustomModal';
import TokenAmountInput from '../../common/TokenAmountInput';
import TokenDropdown from '../../common/TokenDropdown';
import TokenAmountInputSelect from '../TokenAmountInputSelect';

const SECONDARY_COLOR = '#CCDFED'; //'rgba(130, 160, 182, 1)';
const TERTIARY_COLOR = '#4b6980';

export type EarnInterestModalProps = {
  isOpen: boolean;
  options: TokenData[];
  lendingPairs: LendingPair[];
  setIsOpen: (open: boolean) => void;
};

export default function EarnInterestModal(props: EarnInterestModalProps) {
  const { isOpen, options, lendingPairs, setIsOpen } = props;
  const [collateralOptions, setCollateralOptions] = useState<TokenData[]>([]);
  const [selectedOption, setSelectedOption] = useState<TokenData | null>(null);
  const [selectedCollateralOption, setSelectedCollateralOption] = useState<TokenData | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [collateralInputValue, setCollateralInputValue] = useState('');

  useEffect(() => {
    if (options.length > 0) {
      setSelectedOption(options[0]);
    }
  }, [options]);

  useEffect(() => {
    if (selectedOption != null) {
      const selectedTokenAddress = getReferenceAddress(selectedOption);
      const filteredOptions = lendingPairs
        .filter((lendingPair) => {
          const token0Address = getReferenceAddress(lendingPair.token0);
          const token1Address = getReferenceAddress(lendingPair.token1);
          return token0Address === selectedTokenAddress || token1Address === selectedTokenAddress;
        })
        .map((lendingPair) => {
          const token0Address = getReferenceAddress(lendingPair.token0);
          const collateralToken = token0Address === selectedTokenAddress ? lendingPair.token1 : lendingPair.token0;
          return collateralToken;
        });
      setCollateralOptions(filteredOptions);
      setSelectedCollateralOption(filteredOptions[0]);
    }
  }, [selectedOption, lendingPairs]);

  if (selectedOption == null || selectedCollateralOption == null) {
    return null;
  }

  return (
    <CustomModal isOpen={isOpen} title='Earn Interest' setIsOpen={setIsOpen}>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Deposit
            </Text>
            <BaseMaxButton size='L'>MAX</BaseMaxButton>
          </div>
          <TokenAmountInputSelect
            options={options}
            onSelect={(option: TokenData) => {
              setSelectedOption(option);
            }}
            selectedOption={selectedOption}
            inputValue={inputValue}
            onChange={(updatedValue: string) => {
              let output = formatNumberInput(updatedValue);
              if (output != null) {
                setInputValue(output);
              }
            }}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Collateral
          </Text>
          <TokenDropdown
            options={collateralOptions}
            onSelect={(option: TokenData) => {
              setSelectedCollateralOption(option);
            }}
            selectedOption={selectedCollateralOption}
            size='L'
            compact={false}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're depositing {inputValue || '0.00'} {selectedOption.ticker} to the {selectedOption.ticker}/
            {selectedCollateralOption.ticker} lending market. Other users will be able to borrow your{' '}
            {selectedOption.ticker} by posting {selectedCollateralOption.ticker} as collateral.
          </Text>
        </div>
        <div className='w-full'>
          <FilledGreyButton size='M' onClick={() => {}} fillWidth={true}>
            Deposit
          </FilledGreyButton>
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By depositing, you agree to our <a href='/earn/public/terms.pdf'>Terms of Service</a> and acknowledge that
            you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is your duty to
            educate yourself and be aware of the risks.
          </Text>
        </div>
      </div>
    </CustomModal>
  );
}
