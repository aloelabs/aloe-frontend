import React from 'react';
import { formatUSDAuto, roundPercentage } from '../../util/Numbers';
import InfoFigure from '../common/InfoFigure';

const FIGURE_COLOR = 'rgba(255, 255, 255, 0.6)';

export type LendTokenInfoProps = {
  totalSupply: number;
  utilization: number;
  shouldGrow?: boolean;
};

export default function LendTokenInfo(props: LendTokenInfoProps) {
  const { totalSupply, utilization, shouldGrow } = props;
  return (
    <InfoFigure
      label0='Total Supply'
      value0={formatUSDAuto(totalSupply)}
      label1='Utilization'
      value1={`${roundPercentage(utilization)}%`}
      figureColor={FIGURE_COLOR}
      shouldGrow={shouldGrow}
    />
  );
}
