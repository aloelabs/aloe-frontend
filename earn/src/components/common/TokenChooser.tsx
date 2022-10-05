import { RadioGroup } from '@headlessui/react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { TokenData } from '../../data/TokenData';
import { StyledRadioButton } from './Buttons';

const RadioButtonsContainer = styled.div`
  ${tw`flex`}
  padding: 4px;
  border-radius: 8px;
  background-color: rgba(13, 23, 30, 1);
  border: 1px solid rgba(26, 41, 52, 1);
`;

export type TokenChooserProps = {
  token0: TokenData;
  token1: TokenData;
  isToken0Selected: boolean;
  setIsToken0Selected: (updatedValue: boolean) => void;
};

export default function TokenChooser(props: TokenChooserProps) {
  const { token0, token1, isToken0Selected, setIsToken0Selected } = props;
  return (
    <RadioGroup
      value={isToken0Selected ? token0.address : token1.address}
      onChange={(updatedValue: string) => {
        let isToken0CurrentlySelected = updatedValue === token0.address;
        if (isToken0CurrentlySelected !== isToken0Selected) {
          //Do not needlessly update the value
          setIsToken0Selected(isToken0CurrentlySelected);
        }
      }}
    >
      <RadioButtonsContainer>
        <RadioGroup.Option value={token0.address}>
          {({ checked }) => (
            <StyledRadioButton checked={checked} label={token0?.ticker || ''} />
          )}
        </RadioGroup.Option>
        <RadioGroup.Option value={token1.address}>
          {({ checked }) => (
            <StyledRadioButton checked={checked} label={token1?.ticker || ''} />
          )}
        </RadioGroup.Option>
      </RadioButtonsContainer>
    </RadioGroup>
  );
}
