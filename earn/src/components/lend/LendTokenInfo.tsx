import { TokenData } from '../../data/TokenData';
import { roundPercentage, formatTokenAmount, formatUSDAuto } from '../../util/Numbers';
import InfoFigure from '../common/InfoFigure';

const FIGURE_COLOR = 'rgba(255, 255, 255, 0.6)';

export type LendTokenInfoProps = {
  token?: TokenData;
  totalSupply: number;
  utilization: number;
  shouldGrow?: boolean;
};

export default function LendTokenInfo(props: LendTokenInfoProps) {
  const { token, totalSupply, utilization, shouldGrow } = props;
  return (
    <InfoFigure
      label0='Total Supply'
      value0={token ? `${formatTokenAmount(totalSupply)} ${token.ticker}` : formatUSDAuto(totalSupply)}
      label1='Utilization'
      value1={`${roundPercentage(utilization)}%`}
      figureColor={FIGURE_COLOR}
      shouldGrow={shouldGrow}
    />
  );
}
