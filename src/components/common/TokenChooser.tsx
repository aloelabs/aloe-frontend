import { RadioGroup } from '@headlessui/react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { GetTokenData, TokenData } from '../../data/TokenData';
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
  token0Selected: boolean;
  setToken0Selected: (updatedValue: boolean) => void;
};

export default function TokenChooser(props: TokenChooserProps) {
  const { token0, token1, token0Selected, setToken0Selected } = props;
  return (
    <RadioGroup
      value={token0Selected ? token0.address : token1.address}
      onChange={(updatedValue: string) => {
        setToken0Selected(updatedValue === token0.address);
      }}
    >
      <RadioButtonsContainer>
        <RadioGroup.Option value={token0.address}>
          {({ checked }) => (
            <StyledRadioButton
              checked={checked}
              label={token0?.ticker || ''}
            />
          )}
        </RadioGroup.Option>
        <RadioGroup.Option value={token1.address}>
          {({ checked }) => (
            <StyledRadioButton
              checked={checked}
              label={token1?.ticker || ''}
            />
          )}
        </RadioGroup.Option>
      </RadioButtonsContainer>
    </RadioGroup>
  );
}
