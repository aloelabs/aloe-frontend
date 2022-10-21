import { ReactChild } from 'react';

import styled from 'styled-components';

const LabelWrapper = styled.label`
  user-select: none;
  cursor: pointer;
`;

const HiddenInput = styled.input`
  display: none;
`;

export type ToggleButtonProps = {
  children: ReactChild;
  isActive: boolean;
  setIsActive: (isActive: boolean) => void;
  desc?: string;
};

export default function ToggleButton(props: ToggleButtonProps) {
  const { children, isActive, setIsActive, desc } = props;
  return (
    <LabelWrapper>
      {children}
      <HiddenInput
        type='checkbox'
        title={desc || 'toggle'}
        checked={isActive}
        onChange={() => setIsActive(!isActive)}
      />
    </LabelWrapper>
  );
}
